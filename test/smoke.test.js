// Smoke test: starts server/index.js on a free port with a throwaway database and
// exercises login, sessions/devices, roles, points, penalties, undo, weekly challenges, settings,
// past weeks, the startup check and the PIN lockout. Never touches data/.
//
//   node --test
//
// Needs Node 22.5+ (node:sqlite, global fetch). No dependencies.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs'),
  os = require('node:os'),
  path = require('node:path'),
  net = require('node:net');

const ROOT = path.join(__dirname, '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'little-wins-smoke-'));
const DB = path.join(TMP, 'test.db');
const ENV = { PARENT_PIN: '4821', CHILD_PIN: '7390', SECRET: 'smoke-test-secret-0123456789' };

const freePort = () =>
  new Promise((r) => {
    const s = net.createServer().listen(0, () => {
      const p = s.address().port;
      s.close(() => r(p));
    });
  });

// Start the server; resolves once it prints "up", rejects if it exits first.
function start(env = {}) {
  return freePort().then(
    (port) =>
      new Promise((resolve, reject) => {
        const child = spawn(process.execPath, ['server/index.js'], {
          cwd: ROOT,
          env: {
            PATH: process.env.PATH,
            TZ: process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone,
            DB,
            PORT: String(port),
            ...env,
          },
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        let out = '';
        child.stdout.on('data', (d) => {
          out += d;
          if (/\bup\b/.test(out)) resolve({ child, base: `http://127.0.0.1:${port}` });
        });
        child.stderr.on('data', (d) => {
          out += d;
        });
        child.on('exit', (code) =>
          reject(Object.assign(new Error(`server exited (${code}): ${out}`), { code, out })),
        );
      }),
  );
}
const stop = (s) =>
  new Promise((r) => {
    if (!s || s.child.exitCode !== null) return r();
    s.child.once('exit', r);
    s.child.kill();
  });

let srv;
const get = (p, cookie) => fetch(srv.base + p, { headers: cookie ? { cookie } : {} });
async function post(p, body, cookie) {
  const r = await fetch(srv.base + p, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
  return { status: r.status, json: await r.json().catch(() => null), headers: r.headers };
}
async function login(pin) {
  const r = await post('/api/login', { pin });
  assert.equal(r.status, 200, `login with ${pin} failed: ${JSON.stringify(r.json)}`);
  return r.headers.get('set-cookie').split(';')[0];
}
let parent, child;
const state = async (c = parent) => (await get('/api/state', c)).json();
const item = (S, kind, name) =>
  S.items.find((i) => i.kind === kind && (!name || i.name.startsWith(name)));

before(async () => {
  srv = await start(ENV);
});
after(async () => {
  await stop(srv);
  fs.rmSync(TMP, { recursive: true, force: true });
});

test('startup check refuses placeholder or weak settings', async () => {
  const cases = [
    [{}, /PARENT_PIN is a placeholder/],
    [{ ...ENV, SECRET: 'change-this-long-random-string' }, /SECRET is a placeholder/],
    [{ ...ENV, SECRET: 'short' }, /shorter than 16/],
    [{ ...ENV, CHILD_PIN: ENV.PARENT_PIN }, /are the same/],
  ];
  for (const [env, msg] of cases) {
    const err = await start({ ...env, DB: path.join(TMP, 'refused.db') }).then(
      (s) => {
        stop(s);
        return null;
      },
      (e) => e,
    );
    assert.ok(err, `server started with ${JSON.stringify(env)}`);
    assert.equal(err.code, 1);
    assert.match(err.out, msg);
  }
  assert.equal(
    fs.existsSync(path.join(TMP, 'refused.db')),
    false,
    'refused server should not create a database',
  );
});

test('serves the page and static files, blocks other paths', async () => {
  assert.equal((await get('/')).status, 200);
  assert.match(await (await get('/')).text(), /Little Wins/);
  assert.equal((await get('/manifest.json')).headers.get('content-type'), 'application/json');
  // fetch() would normalize "/../x" to "/x", so send the raw paths with http.get.
  const raw = (p) =>
    new Promise((res, rej) =>
      require('node:http')
        .get(`${srv.base}/`, { path: p }, (r) => {
          r.resume();
          res(r.statusCode);
        })
        .on('error', rej),
    );
  assert.equal(await raw('/?from=home-screen'), 200, 'a query string still serves the page');
  // Real files outside public/, so a missing path check would serve them.
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
    assert.equal(await raw(p), 404, p);
});

test('login: wrong PIN, roles, forged cookie', async () => {
  assert.equal((await get('/api/state')).status, 401);
  assert.equal((await post('/api/login', { pin: '0000' })).status, 401);
  parent = await login(ENV.PARENT_PIN);
  child = await login(ENV.CHILD_PIN);
  assert.equal((await state(parent)).role, 'parent');
  assert.equal((await state(child)).role, 'child');
  assert.match(parent, /^t=[\w-]{43}$/, 'login gives a random session token');
  const tok = parent.slice(2);
  const flip = tok.slice(0, -1) + (tok.at(-1) === 'A' ? 'B' : 'A');
  for (const c of [
    't=parent.0000000000',
    `t=parent.${'0'.repeat(20)}`,
    `t=child.${'0'.repeat(20)}`,
    `t=${flip}`,
    `t=${tok}x`,
    `t=${'A'.repeat(43)}`,
  ])
    assert.equal((await get('/api/state', c)).status, 401, c);
});

test('session tokens are stored hashed, not as-is', async () => {
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(DB, { readOnly: true });
  const rows = db
    .prepare('SELECT token_hash FROM sessions')
    .all()
    .map((r) => r.token_hash);
  db.close();
  assert.ok(rows.length >= 2);
  assert.ok(!rows.includes(parent.slice(2)));
  assert.ok(
    rows.includes(
      require('node:crypto').createHash('sha256').update(parent.slice(2)).digest('hex'),
    ),
  );
});

test('devices: listed for parents only, and can be logged out', async () => {
  const S = await state(parent);
  assert.equal(S.devices.filter((d) => d.me).length, 1, 'exactly one device is "this device"');
  assert.ok(S.devices.some((d) => d.role === 'child'));
  assert.equal((await state(child)).devices, undefined, 'the child does not see devices');
  assert.equal((await post('/api/session/revoke', { id: S.devices[0].id }, child)).status, 403);

  // A second child device and a second parent device.
  const extraChild = await login(ENV.CHILD_PIN);
  const extraParent = await login(ENV.PARENT_PIN);
  const D = (await state(parent)).devices;
  const newestChild = Math.max(...D.filter((d) => d.role === 'child').map((d) => d.id)); // = extraChild

  // Log out the extra child device from the main parent device.
  const after = (await post('/api/session/revoke', { id: newestChild }, parent)).json;
  assert.equal(after.devices.length, D.length - 1);
  assert.equal((await get('/api/state', extraChild)).status, 401, 'revoked device is logged out');
  assert.equal((await get('/api/state', child)).status, 200, 'other child device stays logged in');

  // Logging out your own device: 401 and the cookie is cleared.
  const meId = (await state(extraParent)).devices.find((d) => d.me).id;
  const r = await post('/api/session/revoke', { id: meId }, extraParent);
  assert.equal(r.status, 401);
  assert.match(r.headers.get('set-cookie'), /^t=;.*Max-Age=0/);
  assert.equal((await get('/api/state', extraParent)).status, 401);
  assert.equal(
    (await get('/api/state', parent)).status,
    200,
    'other parent devices stay logged in',
  );
});

test('request bodies over 10 KB are refused', async () => {
  const big = JSON.stringify({ pin: 'x'.repeat(20000) });
  const r = await fetch(`${srv.base}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: big,
  });
  assert.equal(r.status, 413);
  const r2 = await fetch(`${srv.base}/api/item/save`, {
    method: 'POST',
    headers: { cookie: parent },
    body: JSON.stringify({ kind: 'target', name: 'x', note: 'y'.repeat(20000) }),
  });
  assert.equal(r2.status, 413);
  assert.equal((await get('/api/state', parent)).status, 200, 'server still fine afterwards');
  assert.equal(
    (await post('/api/login', { pin: '9'.repeat(100) })).status,
    401,
    'normal-size bodies still handled',
  );
});

test('seed data is present', async () => {
  const S = await state();
  assert.equal(S.items.filter((i) => i.kind === 'target').length, 9);
  assert.equal(S.items.filter((i) => i.kind === 'penalty').length, 3);
  assert.equal(S.items.filter((i) => i.kind === 'challenge').length, 4);
  assert.equal(S.rewards.length, 6);
  assert.equal(S.balance, 0);
  assert.equal(S.stars, 0);
});

test('the child can view but not change anything, and never sees penalties', async () => {
  const S = await state(child);
  assert.equal(
    S.items.some((i) => i.kind === 'penalty'),
    false,
  );
  const t = item(await state(), 'target');
  for (const [p, b] of [
    ['/api/add', { item_id: t.id }],
    ['/api/item/save', { kind: 'target', name: 'x' }],
    ['/api/reward/delete', { id: 1 }],
    ['/api/undo', { id: 1 }],
  ])
    assert.equal((await post(p, b, child)).status, 403, p);
  assert.equal((await state()).balance, 0);
});

test('points: fixed, ranged (clamped), penalty floors at 0, undo', async () => {
  let S = await state();
  const fixed = item(S, 'target', 'Reading 20 min'); // 5 pts
  const ranged = item(S, 'target', 'Help with a family chore'); // 5-15 pts
  const pen = item(S, 'penalty', 'Hitting or hurting someone'); // -50

  S = (await post('/api/add', { item_id: fixed.id, points: 999 }, parent)).json;
  assert.equal(S.balance, 5, 'fixed item ignores requested points');
  S = (await post('/api/add', { item_id: ranged.id, points: 12 }, parent)).json;
  assert.equal(S.balance, 17);
  S = (await post('/api/add', { item_id: ranged.id, points: 999 }, parent)).json;
  assert.equal(S.balance, 32, 'ranged item clamps to max');

  S = (await post('/api/add', { item_id: pen.id }, parent)).json;
  assert.equal(S.balance, 0, 'balance never goes below 0');
  assert.equal(S.hist[0].points, -50);

  S = (await post('/api/undo', { id: S.hist[0].id }, parent)).json;
  assert.equal(S.balance, 32, 'undo restores the balance');

  const h = await state(child);
  assert.equal(h.balance, 32);
  assert.ok(
    h.hist.every((e) => e.points > 0),
    'the child only sees positive entries',
  );
  assert.ok(
    h.hist.every((e) => e.note === ''),
    'the child never sees notes',
  );
});

test('warnings count per target per day; challenges cannot get points', async () => {
  let S = await state();
  const t = item(S, 'target'),
    ch = item(S, 'challenge');
  await post('/api/warn', { item_id: t.id }, parent);
  S = (await post('/api/warn', { item_id: t.id }, parent)).json;
  assert.equal(S.warn[t.id], 2);
  assert.equal((await post('/api/add', { item_id: ch.id }, parent)).status, 400);
  assert.equal((await post('/api/warn', { item_id: ch.id }, parent)).status, 400);
});

test('weekly challenges: marks, stars, day validation', async () => {
  let S = await state();
  const ch = item(S, 'challenge');
  const days = S.week.days.filter((d) => d <= S.today); // days of this week up to today
  const k = S.week.days.indexOf(S.today);

  S = (await post('/api/mark', { item_id: ch.id, mark: 'perfect', day: S.today }, parent)).json;
  assert.equal(S.week.marks[ch.id][k], 'perfect');
  S = (await post('/api/mark', { item_id: ch.id, mark: 'ok', day: S.today }, parent)).json;
  assert.equal(S.week.marks[ch.id][k], 'ok', 're-marking a day replaces the old mark');

  const nextWeek = new Date(`${S.week.days[6]}T12:00:00`);
  nextWeek.setDate(nextWeek.getDate() + 1);
  for (const day of [nextWeek.toLocaleDateString('en-CA'), '2026-02-30', '2026-1-5', 'garbage'])
    assert.equal(
      (await post('/api/mark', { item_id: ch.id, mark: 'perfect', day }, parent)).status,
      400,
      day,
    );
  assert.equal(
    (await post('/api/mark', { item_id: ch.id, mark: 'great', day: S.today }, parent)).status,
    400,
  );

  // The star rule needs 2 days in one week. On Monday this week has only one, so use last week
  // (the API allows marks on past days and ?week= keeps the view there).
  const shift = (d, n) => {
    const x = new Date(`${d}T12:00:00`);
    x.setDate(x.getDate() + n);
    return x.toLocaleDateString('en-CA');
  };
  const lastWeek = days.length < 2;
  const week = lastWeek ? S.week.prev : S.week.start;
  const [d0, d1, d2] = lastWeek
    ? [shift(week, 0), shift(week, 1), shift(week, 2)]
    : [days[0], S.today, days[1]];
  const mark = async (day, m) =>
    (await post(`/api/mark?week=${week}`, { item_id: ch.id, mark: m, day }, parent)).json;
  const stars0 = S.stars;

  S = await mark(d0, 'perfect');
  assert.equal(S.stars, stars0, 'one perfect day is not enough');
  S = await mark(d1, 'perfect');
  assert.equal(S.stars, stars0 + 1, '2 perfect days and no bad day wins a star');
  assert.equal(S.won[ch.id], 1);
  S = await mark(d2, 'bad');
  assert.equal(S.stars, stars0, 'a bad day loses the star');
});

test('past weeks: browse, clamp, and fix marks on past days', async () => {
  const shift = (d, n) => {
    const x = new Date(`${d}T12:00:00`);
    x.setDate(x.getDate() + n);
    return x.toLocaleDateString('en-CA');
  };
  const W = async (week, c = parent) =>
    (await get(`/api/state?week=${encodeURIComponent(week)}`, c)).json();
  let S = await state();
  const ch = item(S, 'challenge', 'Kind words'),
    thisMon = S.week.start,
    lastMon = S.week.prev;
  assert.deepEqual([S.week.current, S.week.next], [true, null]);
  assert.equal(lastMon, shift(thisMon, -7), 'can always go back at least one week');

  S = await W(shift(lastMon, 3)); // any day of a week selects that week
  assert.deepEqual(
    [S.week.start, S.week.current, S.week.next, S.week.prev],
    [lastMon, false, thisMon, null],
  );
  assert.deepEqual([S.week.days[0], S.week.days[6]], [lastMon, shift(lastMon, 6)]);
  assert.equal((await W('2099-01-05')).week.start, thisMon, 'future weeks clamp to this week');
  assert.equal(
    (await W('2020-01-01')).week.start,
    lastMon,
    'weeks before any entries clamp to the earliest',
  );
  assert.equal((await W('garbage')).week.start, thisMon);
  assert.equal((await W(lastMon, child)).week.start, lastMon, 'the child can browse past weeks');

  // Fix last week: Saturday and Sunday perfect -> a star for that week.
  const stars0 = S.stars;
  await post(
    `/api/mark?week=${lastMon}`,
    { item_id: ch.id, mark: 'perfect', day: shift(lastMon, 5) },
    parent,
  );
  const r = await post(
    `/api/mark?week=${lastMon}`,
    { item_id: ch.id, mark: 'perfect', day: shift(lastMon, 6) },
    parent,
  );
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
  assert.equal((await W(lastMon, child)).won[ch.id], 1);
  const r2 = await post(
    `/api/mark?week=${lastMon}`,
    { item_id: ch.id, mark: 'bad', day: lastMon },
    parent,
  );
  assert.equal(r2.json.stars, stars0, 'a bad day in that week takes the star back');

  assert.equal(
    (await post('/api/mark', { item_id: ch.id, mark: 'ok', day: shift(S.today, 1) }, parent))
      .status,
    400,
    'no marks on future days',
  );
  assert.equal(
    (await post(`/api/mark?week=${lastMon}`, { item_id: ch.id, mark: 'ok', day: lastMon }, child))
      .status,
    403,
  );

  // Marking an older day (as an old entry would) lets you browse back to it.
  const old = shift(thisMon, -70);
  await post('/api/mark', { item_id: ch.id, mark: 'ok', day: old }, parent);
  S = await W('2020-01-01');
  assert.deepEqual([S.week.start, S.week.prev, S.week.next], [old, null, shift(old, 7)]);
});

test('settings: add, edit, reorder, remove items and rewards', async () => {
  let S = (
    await post(
      '/api/item/save',
      { kind: 'target', name: '  Brush teeth  ', note: 'per day', pmin: 8, pmax: 3 },
      parent,
    )
  ).json;
  const it = item(S, 'target', 'Brush teeth');
  assert.ok(it, 'item added (name trimmed)');
  assert.deepEqual([it.pmin, it.pmax], [8, 8], 'max below min is raised to min');
  assert.equal((await post('/api/item/save', { kind: 'target', name: '   ' }, parent)).status, 400);

  S = (
    await post(
      '/api/item/save',
      { id: it.id, kind: 'target', name: 'Brush teeth x2', pmin: 5, pmax: 10 },
      parent,
    )
  ).json;
  assert.deepEqual(
    [item(S, 'target', 'Brush teeth').name, item(S, 'target', 'Brush teeth').pmax],
    ['Brush teeth x2', 10],
  );

  const targets = () => S.items.filter((i) => i.kind === 'target').map((i) => i.id);
  const last = targets().at(-1);
  S = (await post('/api/item/move', { id: last, dir: -1 }, parent)).json;
  assert.equal(targets().at(-2), last, 'moved up one place');

  S = (await post('/api/item/delete', { id: it.id }, parent)).json;
  assert.equal(item(S, 'target', 'Brush teeth'), undefined);

  S = (await post('/api/reward/save', { name: 'Movie night', stars: 2, points: 50 }, parent)).json;
  const rw = S.rewards.find((r) => r.name === 'Movie night');
  assert.equal(S.rewards.at(-1).id, rw.id, 'new reward goes last');
  S = (await post('/api/reward/move', { id: rw.id, dir: -1 }, parent)).json;
  assert.equal(S.rewards.at(-2).id, rw.id);
  S = (await post('/api/reward/delete', { id: rw.id }, parent)).json;
  assert.equal(
    S.rewards.some((r) => r.id === rw.id),
    false,
  );
});

test("the child's name is a parent setting, shown to everyone", async () => {
  assert.equal((await state()).childName, '');
  let S = (await post('/api/settings/save', { child_name: '  Sam  ' }, parent)).json;
  assert.equal(S.childName, 'Sam', 'trimmed');
  assert.equal((await state(child)).childName, 'Sam');
  assert.equal((await post('/api/settings/save', { child_name: 'X' }, child)).status, 403);
  S = (await post('/api/settings/save', { child_name: 'y'.repeat(100) }, parent)).json;
  assert.equal(S.childName.length, 40, 'capped at 40 characters');
});

test('bad requests do not crash the server', async () => {
  assert.equal((await post('/api/nope', {}, parent)).status, 400);
  const r = await fetch(`${srv.base}/api/add`, {
    method: 'POST',
    headers: { cookie: parent },
    body: '{not json',
  });
  assert.equal(r.status, 400);
  assert.equal((await get('/api/state', parent)).status, 200);
});

test('data survives a restart, and logins stay valid', async () => {
  const before = await state();
  await stop(srv);
  srv = await start(ENV);
  const after = await state(parent);
  assert.equal(after.balance, before.balance);
  assert.equal(after.stars, before.stars);
  assert.equal(after.items.length, before.items.length);
});

// Last: this locks logins for the rest of the run.
test('PIN lockout after 5 wrong tries, even for the right PIN', async () => {
  for (let i = 0; i < 5; i++) assert.equal((await post('/api/login', { pin: '1111' })).status, 401);
  const r = await post('/api/login', { pin: ENV.PARENT_PIN });
  assert.equal(r.status, 429);
  assert.match(r.json.error, /Try again in \d+s/);
  assert.equal((await get('/api/state', parent)).status, 200, 'existing logins keep working');
});
