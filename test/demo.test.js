// Demo families (DEMO_FAMILIES=1): a private made-up family per visitor, in memory only, with
// a switch between the parent's and the child's view; and the tour video at /tour.mp4.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { jar, startServer, startFails, ROOT } = require('./helpers');

const DEMO = { DEMO_FAMILIES: '1' };
const demoServer = (env = {}) => startServer({ allowlist: '*', env: { ...DEMO, ...env } });

/** A new demo family in its own cookie jar; returns { jar, start, state }. */
async function startDemo(srv, body = { timezone: 'America/Chicago', language: 'en' }) {
  const j = jar();
  const start = await srv.api(j, '/api/demo/start', body);
  const state = start.status === 200 ? (await srv.api(j, '/api/state')).json : null;
  return { jar: j, start, state };
}

const unlocked = (S) => S.rewards.filter((r) => S.stars >= r.stars && S.balance >= r.points);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test('DM-01 with demo families off there is no demo: no button, 404, and a demo cookie is ignored', async () => {
  const srv = await startServer({ allowlist: '*' });
  try {
    const cfg = await srv.api(null, '/api/config');
    assert.equal(cfg.json.demo, false);
    const r = await srv.api(jar(), '/api/demo/start', {});
    assert.equal(r.status, 404);
    const j = jar();
    j.c.lw_demo = 'x'.repeat(43);
    assert.equal((await srv.api(j, '/api/state')).json.code, 'login');
  } finally {
    await srv.close();
  }
});

test('DM-02 Try a demo opens a new family as its parent, with a demo cookie that ends with the browser', async () => {
  const srv = await demoServer();
  try {
    assert.equal((await srv.api(null, '/api/config')).json.demo, true);
    const {
      jar: j,
      start,
      state: S,
    } = await startDemo(srv, {
      timezone: 'Europe/Paris',
      language: 'fr',
    });
    assert.equal(start.status, 200);
    const cookie = start.headers.getSetCookie().find((c) => c.startsWith('lw_demo='));
    assert.match(cookie, /^lw_demo=[\w-]{43}; Path=\/; HttpOnly; SameSite=Strict$/);
    assert.ok(!j.c.lw_session, 'no real session is made');
    assert.equal(S.role, 'parent');
    assert.deepEqual(S.demo, { idleSeconds: 1800 });
    assert.equal(S.family.timezone, 'Europe/Paris');
    assert.equal(S.family.language, 'fr');
    assert.equal(S.family.name, 'Famille de démo');
    assert.deepEqual(
      S.children.map((c) => c.name),
      ['Mia', 'Léo'],
    );
    assert.ok(S.items.some((i) => i.kind === 'penalty'));
    assert.equal(S.rewards.length, 6);
    // Junk time zone and language fall back to UTC and English.
    const other = await startDemo(srv, { timezone: 'Mars/Olympus', language: 'xx' });
    assert.equal(other.state.family.timezone, 'UTC');
    assert.equal(other.state.family.language, 'en');
    assert.equal(other.state.family.name, 'Demo family');
  } finally {
    await srv.close();
  }
});

test('DM-03 the made-up history: rewards unlocked and in progress, stars, points, the odd penalty', async () => {
  const srv = await demoServer();
  try {
    const { jar: j, state: mia } = await startDemo(srv);
    assert.equal(mia.childName, 'Mia');
    assert.ok(mia.stars >= 3, `Mia has ${mia.stars} stars`);
    assert.ok(mia.balance > 100);
    assert.ok(unlocked(mia).length >= 1, 'Mia has an unlocked reward');
    assert.ok(unlocked(mia).length < mia.rewards.length, 'and one still in progress');
    assert.ok(mia.hist.length > 20);
    const leo = (await srv.api(j, `/api/state?child=${mia.children[1].id}`)).json;
    assert.equal(leo.childName, 'Leo');
    assert.ok(leo.stars < mia.stars);
    assert.ok(leo.balance > 0);
    assert.ok(
      leo.hist.some((e) => e.kind === 'points' && e.points < 0),
      'a penalty parents see',
    );
    assert.ok(
      leo.hist.some((e) => e.kind === 'warn'),
      'a warning',
    );
    // Past weeks can be browsed, and nothing is dated in the future.
    assert.ok(mia.week.prev);
    assert.ok(mia.hist.every((e) => e.ts <= new Date().toISOString()));
  } finally {
    await srv.close();
  }
});

test("DM-04 the child's view shows only what that child's device would, and switches back", async () => {
  const srv = await demoServer();
  try {
    const { jar: j, state: P } = await startDemo(srv);
    const leoId = P.children[1].id;
    const C = await srv.api(j, '/api/demo/view', { as: 'child', child_id: leoId });
    assert.equal(C.status, 200);
    const S = C.json;
    assert.equal(S.role, 'child');
    assert.equal(S.childName, 'Leo');
    assert.deepEqual(
      S.children.map((c) => c.id),
      [leoId],
    );
    assert.ok(!S.items.some((i) => i.kind === 'penalty'), 'no penalties');
    assert.deepEqual(S.warn, {});
    assert.ok(S.hist.every((e) => e.kind !== 'warn' && !(e.points < 0) && !e.note));
    for (const k of ['parents', 'devices', 'invites', 'me']) assert.equal(S[k], undefined, k);
    assert.ok(S.demo, 'the banner still shows');
    // The child's view can't change things, and the state stays the child's on a reload.
    const item = P.items.find((i) => i.kind === 'target');
    const add = await srv.api(j, '/api/add', { child_id: leoId, item_id: item.id });
    assert.equal(add.status, 403);
    assert.equal(add.json.code, 'viewOnly');
    assert.equal((await srv.api(j, '/api/state')).json.role, 'child');
    // Another family's child, or none: 404.
    const miss = await srv.api(j, '/api/demo/view', { as: 'child', child_id: 999999 });
    assert.equal(miss.status, 404);
    const back = await srv.api(j, '/api/demo/view', { as: 'parent' });
    assert.equal(back.json.role, 'parent');
    assert.ok(back.json.parents.length === 1);
  } finally {
    await srv.close();
  }
});

test('DM-05 a demo does day-to-day things, and refuses invites, devices, export, delete and the rest', async () => {
  const srv = await demoServer();
  try {
    const { jar: j, state: S } = await startDemo(srv);
    const cid = S.childId;
    const target = S.items.find((i) => i.kind === 'target' && i.pmin === i.pmax);
    const add = await srv.api(j, '/api/add', { child_id: cid, item_id: target.id });
    assert.equal(add.status, 200);
    assert.equal(add.json.balance, S.balance + target.pmin);
    assert.equal((await srv.api(j, '/api/undo', { id: add.json.hist[0].id })).status, 200);
    const ch = S.items.find((i) => i.kind === 'challenge');
    assert.equal(
      (await srv.api(j, '/api/mark', { child_id: cid, item_id: ch.id, mark: 'perfect' })).status,
      200,
    );
    const saved = await srv.api(j, '/api/item/save', { kind: 'target', name: 'Feed the cat' });
    assert.ok(saved.json.items.some((i) => i.name === 'Feed the cat'));
    const fam = await srv.api(j, '/api/family/save', {
      name: 'Our demo',
      timezone: 'UTC',
      week_start: 0,
      language: 'de',
    });
    assert.equal(fam.json.family.language, 'de');
    assert.equal((await srv.api(j, '/api/child/save', { name: 'Ada' })).status, 200);

    const off = {
      '/api/invite/create': {},
      '/api/invite/revoke': { id: 1 },
      '/api/parent/remove': { user_id: 1 },
      '/api/owner/transfer': { user_id: 1 },
      '/api/pairing/create': { child_id: cid },
      '/api/family/delete': { confirm: 'Our demo' },
      '/api/session/revoke': { id: S.devices[0].id },
      '/api/setup': { family_name: 'x', child_name: 'y', timezone: 'UTC' },
      '/api/logout': {},
    };
    for (const [p, body] of Object.entries(off)) {
      const r = await srv.api(j, p, body);
      assert.equal(r.status, 403, p);
      assert.equal(r.json.code, 'demoOff', p);
    }
    for (const p of ['/api/export', '/api/operator']) {
      const r = await srv.api(j, p);
      assert.equal(r.json.code, 'demoOff', p);
    }
    // Still there, unchanged by the refused calls.
    const after = (await srv.api(j, '/api/state')).json;
    assert.equal(after.family.name, 'Our demo');
    assert.equal(after.devices.length, 1);
    assert.equal(after.operator, undefined);
  } finally {
    await srv.close();
  }
});

test('DM-06 demo families never reach the database file, and a real session survives a demo', async () => {
  const srv = await demoServer();
  try {
    const real = await srv.newFamily({ name: 'Real Family', child: 'Real Kid' });
    const demo = await startDemo(srv);
    await srv.api(demo.jar, '/api/add', {
      child_id: demo.state.childId,
      item_id: demo.state.items[0].id,
    });
    const rows = srv.sql((db) => ({
      families: db.prepare('SELECT name FROM families').all(),
      demoUsers: db.prepare("SELECT COUNT(*) n FROM users WHERE provider='demo'").get().n,
      children: db.prepare('SELECT name FROM children').all(),
    }));
    assert.deepEqual(
      rows.families.map((f) => f.name),
      ['Real Family'],
    );
    assert.equal(rows.demoUsers, 0);
    assert.deepEqual(
      rows.children.map((c) => c.name),
      ['Real Kid'],
    );
    // One browser with both cookies: the demo wins while it runs, the real family comes back after.
    const both = jar();
    both.c = { ...real.jar.c };
    await srv.api(both, '/api/demo/start', {});
    assert.ok(both.c.lw_session && both.c.lw_demo);
    assert.equal((await srv.api(both, '/api/state')).json.family.name, 'Demo family');
    // Public calls still go to the real app.
    assert.equal((await srv.api(both, '/api/config')).status, 200);
    const left = await srv.api(both, '/api/demo/leave', {});
    assert.equal(left.status, 200);
    assert.ok(!both.c.lw_demo, 'the demo cookie is cleared');
    assert.equal((await srv.api(both, '/api/state')).json.family.name, 'Real Family');
  } finally {
    await srv.close();
  }
});

test('DM-07 cross-family: demo families cannot reach each other or a real family', async () => {
  const srv = await demoServer();
  try {
    const real = await srv.newFamily({ name: 'Real Family', child: 'Real Kid' });
    const a = await startDemo(srv);
    const b = await startDemo(srv);
    const A = a.state;
    // B's view switch, undo, edits and adds with A's IDs: 404, and A is unchanged.
    const aEntry = A.hist.find((e) => e.kind === 'points');
    const tries = [
      ['/api/demo/view', { as: 'child', child_id: A.childId }],
      ['/api/undo', { id: aEntry.id }],
      ['/api/item/delete', { id: A.items[0].id }],
      ['/api/reward/save', { id: A.rewards[0].id, name: 'Taken', stars: 1, points: 0 }],
      ['/api/child/save', { id: A.childId, name: 'Taken' }],
      ['/api/child/delete', { id: A.children[1].id }],
    ];
    for (const [p, body] of tries) {
      const r = await srv.api(b.jar, p, body);
      assert.equal(r.status, 404, p);
    }
    // A demo with a real family's IDs gets nothing, and a real session can't use demo routes.
    const realS = real.state;
    const r1 = await srv.api(b.jar, '/api/demo/view', { as: 'child', child_id: realS.childId });
    assert.equal(r1.status, 404);
    const r2 = await srv.api(b.jar, '/api/child/save', { id: realS.childId, name: 'Taken' });
    assert.equal(r2.status, 404);
    const r3 = await srv.api(real.jar, '/api/demo/view', { as: 'child', child_id: A.childId });
    assert.equal(r3.status, 401, 'demo routes need a demo session');
    const r4 = await srv.api(real.jar, '/api/demo/leave', {});
    assert.equal(r4.status, 401);
    // B leaving deletes B only.
    await srv.api(b.jar, '/api/demo/leave', {});
    const after = (await srv.api(a.jar, '/api/state')).json;
    assert.equal(after.hist.find((e) => e.id === aEntry.id)?.id, aEntry.id);
    assert.deepEqual(after.children, A.children);
    assert.deepEqual(
      after.rewards.map((r) => r.name),
      A.rewards.map((r) => r.name),
    );
    assert.equal((await srv.api(real.jar, '/api/state')).json.childName, 'Real Kid');
  } finally {
    await srv.close();
  }
});

test('DM-08 Leave the demo deletes it at once; its old cookie then says the demo ended', async () => {
  const srv = await demoServer();
  try {
    const { jar: j } = await startDemo(srv);
    const old = { ...j.c };
    const r = await srv.api(j, '/api/demo/leave', {});
    assert.equal(r.status, 200);
    assert.match(
      r.headers.getSetCookie().find((c) => c.startsWith('lw_demo=')),
      /^lw_demo=; .*Max-Age=0/,
    );
    const stale = jar();
    stale.c = old;
    const S = await srv.api(stale, '/api/state');
    assert.equal(S.status, 401);
    assert.equal(S.json.code, 'demoEnded');
    assert.ok(!stale.c.lw_demo, 'the stale cookie is cleared');
  } finally {
    await srv.close();
  }
});

test('DM-09 an idle demo family is deleted after DEMO_IDLE_SECONDS, and its place freed', async () => {
  const srv = await demoServer({ DEMO_IDLE_SECONDS: '1', DEMO_MAX: '1' });
  try {
    const a = await startDemo(srv);
    assert.equal(a.state.demo.idleSeconds, 1);
    assert.equal((await startDemo(srv)).start.status, 503);
    await sleep(2200);
    const S = await srv.api(a.jar, '/api/state');
    assert.equal(S.json.code, 'demoEnded');
    assert.equal((await startDemo(srv)).start.status, 200);
  } finally {
    await srv.close();
  }
});

test('DM-10 past DEMO_MAX a new demo gets a friendly 503 demoFull, until one is left', async () => {
  const srv = await demoServer({ DEMO_MAX: '2' });
  try {
    const a = await startDemo(srv);
    await startDemo(srv);
    const full = await startDemo(srv);
    assert.equal(full.start.status, 503);
    assert.equal(full.start.json.code, 'demoFull');
    assert.match(full.start.json.error, /try again in a few minutes/);
    assert.equal(full.start.headers.get('retry-after'), '300');
    assert.ok(!full.jar.c.lw_demo);
    await srv.api(a.jar, '/api/demo/leave', {});
    assert.equal((await startDemo(srv)).start.status, 200);
  } finally {
    await srv.close();
  }
});

test('DM-11 starting demos is rate limited per client, like sign-in', async () => {
  const srv = await demoServer({ DEMO_MAX: '50' });
  try {
    const codes = [];
    for (let i = 0; i < 11; i++) codes.push((await srv.api(jar(), '/api/demo/start', {})).status);
    assert.deepEqual(codes.slice(0, 10), Array(10).fill(200));
    assert.equal(codes[10], 429);
  } finally {
    await srv.close();
  }
});

test('DM-12 a restart ends every demo; starting one needs JSON from this site', async () => {
  const srv = await demoServer();
  try {
    const { jar: j } = await startDemo(srv);
    await srv.restart();
    assert.equal((await srv.api(j, '/api/state')).json.code, 'demoEnded');
    const foreign = await srv.api(
      jar(),
      '/api/demo/start',
      {},
      {
        headers: { Origin: 'https://evil.example.test' },
      },
    );
    assert.equal(foreign.status, 403);
    const form = await srv.api(jar(), '/api/demo/start', 'a=1', {
      contentType: 'application/x-www-form-urlencoded',
    });
    assert.equal(form.status, 415);
    assert.equal((await srv.api(jar(), '/api/demo/start')).status, 404, 'GET is not a route');
  } finally {
    await srv.close();
  }
});

test('DM-13 the app refuses unreadable demo and video settings', async () => {
  const base = { APP_BASE_URL: 'http://localhost:3999', LITTLE_WINS_FAKE_SSO: '1', PORT: '3999' };
  for (const [k, v] of [
    ['DEMO_FAMILIES', 'yes'],
    ['DEMO_MAX', '0'],
    ['DEMO_IDLE_SECONDS', 'soon'],
    ['TOUR_VIDEO', 'off'],
  ]) {
    const r = await startFails({ ...base, [k]: v });
    assert.equal(r.code, 1, k);
    assert.match(r.out, new RegExp(k), k);
  }
});

const VIDEO = path.join(ROOT, 'public', 'tour.mp4');

test('VD-01 Watch the video is offered when public/tour.mp4 exists, unless TOUR_VIDEO=0', async () => {
  const srv = await startServer();
  const off = await startServer({ env: { TOUR_VIDEO: '0' } });
  try {
    assert.equal((await srv.api(null, '/api/config')).json.tourVideo, fs.existsSync(VIDEO));
    assert.equal((await off.api(null, '/api/config')).json.tourVideo, false);
    // Hidden, but still served (the README links to it).
    if (fs.existsSync(VIDEO)) assert.equal((await off.api(null, '/tour.mp4')).status, 200);
  } finally {
    await srv.close();
    await off.close();
  }
});

test('VD-02 /tour.mp4 is served with byte ranges (Safari asks for them)', {
  skip: !fs.existsSync(VIDEO),
}, async () => {
  const srv = await startServer();
  const size = fs.statSync(VIDEO).size;
  const get = (range, method = 'GET') =>
    fetch(`${srv.base}/tour.mp4`, { method, headers: range ? { Range: range } : {} });
  try {
    const all = await get();
    assert.equal(all.status, 200);
    assert.equal(all.headers.get('content-type'), 'video/mp4');
    assert.equal(all.headers.get('accept-ranges'), 'bytes');
    assert.equal(Number(all.headers.get('content-length')), size);
    assert.equal((await all.arrayBuffer()).byteLength, size);

    const head = await get('bytes=0-1');
    assert.equal(head.status, 206);
    assert.equal(head.headers.get('content-range'), `bytes 0-1/${size}`);
    const bytes = Buffer.from(await head.arrayBuffer());
    assert.deepEqual(bytes, fs.readFileSync(VIDEO).subarray(0, 2));

    const open = await get('bytes=100-');
    assert.equal(open.headers.get('content-range'), `bytes 100-${size - 1}/${size}`);
    assert.equal((await open.arrayBuffer()).byteLength, size - 100);

    const tail = await get('bytes=-10');
    assert.equal(tail.headers.get('content-range'), `bytes ${size - 10}-${size - 1}/${size}`);
    await tail.arrayBuffer();

    const big = await get(`bytes=0-${size + 1000}`);
    assert.equal(big.headers.get('content-range'), `bytes 0-${size - 1}/${size}`);
    await big.arrayBuffer();

    for (const bad of [`bytes=${size}-`, 'bytes=5-2', 'bytes=-', 'pages=1-2', 'bytes=0-1,4-5']) {
      const r = await get(bad);
      assert.equal(r.status, 416, bad);
      assert.equal(r.headers.get('content-range'), `bytes */${size}`);
      await r.arrayBuffer();
    }
    const h = await get('bytes=0-99', 'HEAD');
    assert.equal(h.status, 206);
    assert.equal(h.headers.get('content-length'), '100');
  } finally {
    await srv.close();
  }
});
