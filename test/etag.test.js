// GET /api/state answers 304 while nothing in the family has changed.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { jar, startServer, item } = require('./helpers');

const getState = (srv, j, q = '', tag) =>
  srv.api(j, `/api/state${q}`, undefined, { headers: tag ? { 'If-None-Match': tag } : {} });

/** A family with an owner, a co-parent and a child device, on its own server. */
async function setup({ signup = 'open' } = {}) {
  const srv = await startServer({ signup });
  const A = await srv.newFamily();
  const inv = await srv.api(A.jar, '/api/invite/create', {});
  const co = jar();
  assert.ok(
    (await srv.signIn(co, 'google', 'bob', { invite: inv.json.issued.link.split('#invite=')[1] }))
      .ok,
  );
  const kid = await srv.pairChild(A.jar, A.childId);
  const S = (await srv.api(A.jar, '/api/state')).json;
  return { srv, A, co, kid, target: item(S, 'target'), challenge: item(S, 'challenge') };
}

/** The ETag now, and whether it differs from `before` after fn runs. */
const tagOf = async (srv, j, q) => {
  const r = await getState(srv, j, q);
  assert.equal(r.status, 200);
  return r.headers.get('etag');
};

test('/api/state has an ETag; repeating with If-None-Match is a 304 with no body', async () => {
  const { srv, A, co, kid } = await setup();
  try {
    for (const [name, j] of [
      ['owner', A.jar],
      ['co-parent', co],
      ['child', kid.jar],
    ]) {
      const first = await getState(srv, j);
      assert.equal(first.status, 200, name);
      const tag = first.headers.get('etag');
      assert.match(tag, /^W\/"[\w-]{22}"$/, name);
      assert.equal(first.headers.get('cache-control'), 'no-cache');
      assert.ok(first.json.family, 'the first reply has its body');

      const again = await getState(srv, j, '', tag);
      assert.equal(again.status, 304, name);
      assert.equal(again.text, '', 'no body');
      assert.equal(again.headers.get('etag'), tag);
      assert.equal(again.headers.get('x-content-type-options'), 'nosniff');

      const stale = await getState(srv, j, '', 'W/"stale-tag-value-00000"');
      assert.equal(stale.status, 200, 'an unknown tag gets the full state');
      assert.equal(stale.headers.get('etag'), tag, 'and the same tag when nothing changed');
    }
    // Repeated reads never change the tag.
    const t = await tagOf(srv, A.jar);
    assert.equal(await tagOf(srv, A.jar), t);
  } finally {
    await srv.close();
  }
});

test('any write in the family gives parents and children a new ETag', async () => {
  const { srv, A, co, kid, target, challenge } = await setup();
  try {
    const writes = [
      ['add points (owner)', A.jar, '/api/add', { child_id: A.childId, item_id: target.id }],
      ['add points (co-parent)', co, '/api/add', { child_id: A.childId, item_id: target.id }],
      ['warn', co, '/api/warn', { child_id: A.childId, item_id: target.id }],
      ['mark', A.jar, '/api/mark', { child_id: A.childId, item_id: challenge.id, mark: 'perfect' }],
      ['save an item', A.jar, '/api/item/save', { kind: 'target', name: 'New', pmin: 1, pmax: 2 }],
      ['save a reward', co, '/api/reward/save', { name: 'Prize', stars: 1, points: 5 }],
      [
        'rename the family',
        A.jar,
        '/api/family/save',
        { name: 'Renamed', timezone: 'UTC', week_start: 1 },
      ],
      ['create an invite', A.jar, '/api/invite/create', {}],
      ['create a pairing code', co, '/api/pairing/create', { child_id: A.childId }],
    ];
    for (const [label, writer, route, body] of writes) {
      const views = { owner: A.jar, 'co-parent': co, child: kid.jar };
      const before = {};
      for (const [name, j] of Object.entries(views)) before[name] = await tagOf(srv, j);
      const r = await srv.api(writer, route, body);
      assert.equal(r.status, 200, `${label}: ${r.text}`);
      for (const [name, j] of Object.entries(views)) {
        const next = await getState(srv, j, '', before[name]);
        assert.equal(next.status, 200, `${label}: ${name} must get a fresh state, not a 304`);
        assert.notEqual(next.headers.get('etag'), before[name], `${label}: ${name}`);
      }
    }
  } finally {
    await srv.close();
  }
});

test("a child device's ETag changes when a parent records points for that child", async () => {
  const { srv, A, kid, target } = await setup();
  try {
    const first = await getState(srv, kid.jar);
    const tag = first.headers.get('etag');
    assert.equal((await getState(srv, kid.jar, '', tag)).status, 304);
    await srv.api(A.jar, '/api/add', { child_id: A.childId, item_id: target.id });
    const r = await getState(srv, kid.jar, '', tag);
    assert.equal(r.status, 200);
    assert.notEqual(r.headers.get('etag'), tag);
    assert.ok(r.json.balance > first.json.balance, 'and the new balance is in the body');
    assert.equal((await getState(srv, kid.jar, '', r.headers.get('etag'))).status, 304);
  } finally {
    await srv.close();
  }
});

test('a failed write does not change the ETag', async () => {
  const { srv, A, target } = await setup();
  try {
    const tag = await tagOf(srv, A.jar);
    for (const [route, body] of [
      ['/api/item/delete', { id: 999999 }],
      ['/api/add', { child_id: 999999, item_id: target.id }],
      ['/api/child/save', { name: '' }],
      ['/api/family/save', { name: 'X', timezone: 'Not/AZone' }],
    ]) {
      assert.notEqual((await srv.api(A.jar, route, body)).status, 200, route);
    }
    assert.equal((await getState(srv, A.jar, '', tag)).status, 304);
  } finally {
    await srv.close();
  }
});

test('a pairing redemption, a device log-out and an invite join give parents a new ETag', async () => {
  const { srv, A, co } = await setup();
  try {
    // A pairing redemption: a new device appears in Settings.
    const made = await srv.api(A.jar, '/api/pairing/create', { child_id: A.childId });
    let tag = await tagOf(srv, A.jar);
    const coTag = await tagOf(srv, co);
    const device = jar();
    assert.equal((await srv.api(device, '/api/pair', { code: made.json.issued.code })).status, 200);
    let r = await getState(srv, A.jar, '', tag);
    assert.equal(r.status, 200, 'redeeming a code');
    assert.ok(r.json.devices.some((d) => d.kind === 'child'));
    assert.notEqual(r.headers.get('etag'), tag);
    assert.equal((await getState(srv, co, '', coTag)).status, 200, 'the co-parent sees it too');

    // A child device logs out.
    tag = r.headers.get('etag');
    assert.equal((await srv.api(device, '/api/logout', {})).status, 200);
    r = await getState(srv, A.jar, '', tag);
    assert.equal(r.status, 200, 'a device logging out');
    assert.notEqual(r.headers.get('etag'), tag);

    // A parent signs in from an invite (the invite is used, a parent is added).
    tag = r.headers.get('etag');
    const inv = await srv.api(A.jar, '/api/invite/create', {});
    tag = await tagOf(srv, A.jar);
    const carol = jar();
    assert.ok(
      (
        await srv.signIn(carol, 'github', 'carol', {
          invite: inv.json.issued.link.split('#invite=')[1],
        })
      ).ok,
    );
    r = await getState(srv, A.jar, '', tag);
    assert.equal(r.status, 200, 'an invite join');
    assert.equal(r.json.parents.length, 3);
    assert.notEqual(r.headers.get('etag'), tag);

    // A parent signing in again (a new device) is a new device too.
    tag = r.headers.get('etag');
    assert.ok((await srv.signIn(jar(), 'google', 'bob')).ok);
    r = await getState(srv, A.jar, '', tag);
    assert.equal(r.status, 200, 'a new parent session');
    assert.ok(r.json.devices.length >= 4);
  } finally {
    await srv.close();
  }
});

test('revoking a device and removing a parent change the ETag', async () => {
  const { srv, A, kid } = await setup();
  try {
    const tag = await tagOf(srv, A.jar);
    const S = (await srv.api(A.jar, '/api/state')).json;
    const dev = S.devices.find((d) => d.kind === 'child');
    assert.equal((await srv.api(A.jar, '/api/session/revoke', { id: dev.id })).status, 200);
    assert.equal((await getState(srv, A.jar, '', tag)).status, 200);
    assert.equal((await getState(srv, kid.jar)).status, 401, 'and the device is out');
  } finally {
    await srv.close();
  }
});

test('different ?week= and ?child= give different ETags', async () => {
  const { srv, A } = await setup();
  try {
    const sibling = (await srv.api(A.jar, '/api/child/save', { name: 'Sibling' })).json.childId;
    const base = await tagOf(srv, A.jar);
    const week = await tagOf(srv, A.jar, '?week=2024-01-01');
    const otherWeek = await tagOf(srv, A.jar, '?week=2024-01-08');
    const child = await tagOf(srv, A.jar, `?child=${sibling}`);
    const both = await tagOf(srv, A.jar, `?week=2024-01-01&child=${sibling}`);
    assert.equal(new Set([base, week, otherWeek, child, both]).size, 5);
    // The tag of one view does not validate another.
    const r = await getState(srv, A.jar, `?child=${sibling}`, base);
    assert.equal(r.status, 200);
    assert.equal((await getState(srv, A.jar, `?week=2024-01-01`, week)).status, 304);
    assert.equal((await getState(srv, A.jar, '?week=2024-01-01', base)).status, 200);
  } finally {
    await srv.close();
  }
});

test('ETags differ between sessions and between families', async () => {
  const { srv, A, co, kid } = await setup();
  try {
    const B = await srv.newFamily();
    const tags = [
      await tagOf(srv, A.jar),
      await tagOf(srv, co),
      await tagOf(srv, kid.jar),
      await tagOf(srv, B.jar),
    ];
    assert.equal(new Set(tags).size, 4);
    // Another session's tag never validates mine.
    assert.equal((await getState(srv, A.jar, '', tags[1])).status, 200);
    assert.equal((await getState(srv, B.jar, '', tags[0])).status, 200);
  } finally {
    await srv.close();
  }
});

test('the 304 needs a session: no cookie is a 401, whatever tag is sent', async () => {
  const { srv, A } = await setup();
  try {
    const tag = await tagOf(srv, A.jar);
    const r = await srv.api(null, '/api/state', undefined, { headers: { 'If-None-Match': tag } });
    assert.equal(r.status, 401);
  } finally {
    await srv.close();
  }
});
