// One-time pairing codes for children's devices, and what a child's session may not do.
const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const { jar, SESSION, startServer, parentRouteList } = require('./helpers');

let srv;
let F;
before(async () => {
  srv = await startServer({ signup: 'open' });
  F = await srv.newFamily({ name: 'Pairing', child: 'Pia' });
});
after(() => srv.close());
// Redeeming is limited to 10 per minute per process; a restart gives each test a fresh allowance.
beforeEach(() => srv.restart());

const create = async (childId = F.childId) => {
  const r = await srv.api(F.jar, '/api/pairing/create', { child_id: childId });
  assert.equal(r.status, 200);
  return r.json.issued;
};
const redeem = (code, j = jar(), headers) => srv.api(j, '/api/pair', { code }, { headers });

test('PA-02 a pairing code looks like XXXX-XXXX-XX, comes with a link and lasts about ten minutes', async () => {
  const issued = await create();
  assert.match(issued.code, /^[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{2}$/);
  assert.equal(issued.link, `${srv.base}/#pair=${issued.code.replaceAll('-', '')}`);
  const wait = Date.parse(issued.expires) - Date.now();
  assert.ok(wait > 9 * 60e3 && wait <= 10 * 60e3, `expires in ${wait}ms`);
  const stored = srv.sql((db) => db.prepare('SELECT code_hash FROM pairings').all());
  assert.ok(stored.every((r) => r.code_hash.length === 64 && !issued.link.includes(r.code_hash)));
});

test('PA-03 a code pairs a device once, to the right child, and the device gets a session', async () => {
  const issued = await create();
  const j = jar();
  const r = await redeem(issued.code, j);
  assert.equal(r.status, 200);
  assert.match(j.c[SESSION], /^[\w-]{43}$/);
  const S = (await srv.api(j, '/api/state')).json;
  assert.equal(S.role, 'child');
  assert.equal(S.childName, 'Pia');
  const again = await redeem(issued.code);
  assert.equal(again.status, 400, 'a used code is refused');
  assert.match(again.json.error, /code doesn't work/);
});

test('PA-04 case, dashes and spaces in a typed code do not matter, and the link form works', async () => {
  const a = await create();
  assert.equal((await redeem(a.code.toLowerCase())).status, 200);
  const b = await create();
  assert.equal((await redeem(b.code.replaceAll('-', ' ').toLowerCase())).status, 200);
  const c = await create();
  assert.equal((await redeem(c.link.split('#pair=')[1])).status, 200);
});

test('PA-05 wrong, short, empty and non-text codes are refused', async () => {
  for (const code of ['ABCD-EFGH-JK', 'x', '', null, 12345, {}, 'A'.repeat(200)])
    assert.equal((await redeem(code)).status, 400, JSON.stringify(code));
});

test('PA-06 an expired code is refused', async () => {
  const issued = await create();
  srv.sql((db) => db.prepare('UPDATE pairings SET expires=?').run('2000-01-01T00:00:00.000Z'));
  assert.equal((await redeem(issued.code)).status, 400);
});

test('PA-07 a code for a child who was deleted is refused', async () => {
  const added = await srv.api(F.jar, '/api/child/save', { name: 'Temp' });
  const issued = await create(added.json.childId);
  assert.equal((await srv.api(F.jar, '/api/child/delete', { id: added.json.childId })).status, 200);
  assert.equal((await redeem(issued.code)).status, 400);
});

test('PA-08 a parent cannot make a code for a child outside the family or one that does not exist', async () => {
  assert.equal((await srv.api(F.jar, '/api/pairing/create', { child_id: 999999 })).status, 404);
  assert.equal((await srv.api(F.jar, '/api/pairing/create', {})).status, 404);
});

test("PA-09 a device's label comes from its user agent", async () => {
  const issued = await create();
  const j = jar();
  await redeem(issued.code, j, { 'User-Agent': 'Mozilla/5.0 (Linux; Android 14)' });
  const devices = (await srv.api(F.jar, '/api/state')).json.devices;
  assert.ok(devices.some((d) => d.kind === 'child' && d.device === 'Android' && d.who === 'Pia'));
});

test('PA-10 a child session cannot write anything: every parent route is 403', async () => {
  const dev = await srv.pairChild(F.jar, F.childId);
  const S = (await srv.api(dev.jar, '/api/state')).json;
  const body = {
    child_id: F.childId,
    item_id: S.items[0].id,
    id: S.items[0].id,
    name: 'x',
    kind: 'target',
    user_id: 1,
  };
  const routes = parentRouteList();
  for (const route of routes) {
    assert.equal((await srv.api(dev.jar, route, body)).status, 403, route);
  }
  assert.equal((await srv.api(dev.jar, '/api/setup', body)).status, 403, '/api/setup');
  const after = (await srv.api(dev.jar, '/api/state')).json;
  assert.equal(after.items.length, S.items.length);
  assert.equal(after.balance, S.balance);
  assert.equal((await srv.api(dev.jar, '/api/state')).status, 200, 'the device keeps working');
});

test('PA-11 a parent can log a child device out, and it takes effect at once', async () => {
  const dev = await srv.pairChild(F.jar, F.childId);
  const { devices } = (await srv.api(F.jar, '/api/state')).json;
  const id = devices
    .filter((d) => d.kind === 'child')
    .map((d) => d.id)
    .sort((a, b) => b - a)[0];
  assert.equal((await srv.api(F.jar, '/api/session/revoke', { id })).status, 200);
  assert.equal((await srv.api(dev.jar, '/api/state')).status, 401);
});

test('PA-12 the 11th attempt within a minute is a 429 with Retry-After, even for a good code', async () => {
  const limited = await startServer({ signup: 'open' });
  try {
    const f = await limited.newFamily({});
    const good = (await limited.api(f.jar, '/api/pairing/create', { child_id: f.childId })).json
      .issued;
    for (let i = 0; i < 10; i++)
      assert.equal(
        (await limited.api(null, '/api/pair', { code: 'ABCD-EFGH-JK' })).status,
        400,
        `try ${i + 1}`,
      );
    const r = await limited.api(null, '/api/pair', { code: good.code });
    assert.equal(r.status, 429);
    assert.match(r.json.error, /Try again in \d+s/);
    assert.match(r.headers.get('retry-after'), /^\d+$/);
  } finally {
    await limited.close();
  }
});

test('PA-13 the invite lookup is rate limited the same way', async () => {
  const limited = await startServer({ signup: 'open' });
  try {
    for (let i = 0; i < 10; i++)
      assert.equal(
        (await limited.api(null, '/api/invite/info', { token: 'x'.repeat(30) })).status,
        404,
      );
    assert.equal(
      (await limited.api(null, '/api/invite/info', { token: 'x'.repeat(30) })).status,
      429,
    );
  } finally {
    await limited.close();
  }
});
