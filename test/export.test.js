// The owner's data export and family deletion (design: "Privacy and export").
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { jar, SESSION, startServer, item } = require('./helpers');

const FAMILY_TABLES = [
  'memberships',
  'children',
  'items',
  'rewards',
  'entries',
  'sessions',
  'invites',
  'pairings',
];
const inFamily = (srv, table, fid) =>
  srv.sql((db) => db.prepare(`SELECT COUNT(*) n FROM ${table} WHERE family_id=?`).get(fid).n);
const familyId = (srv, name) =>
  srv.sql((db) => db.prepare('SELECT id FROM families WHERE name=?').get(name)?.id);

/**
 * A family with everything in it: an owner, a co-parent, two children, a started list with an
 * inactive item, rewards, entries (one undone), a child device, an open invite and an open code.
 */
async function build(srv, tag, { owner } = {}) {
  const f = await srv.newFamily({ name: `${tag} Family`, child: `${tag} Kid`, who: owner });
  const post = (p, b) => srv.api(f.jar, p, b);
  let S = (await post('/api/child/save', { name: `${tag} Sibling` })).json;
  const sibling = S.childId;
  S = (
    await post('/api/item/save', {
      kind: 'target',
      name: `${tag} Chore`,
      pmin: 5,
      pmax: 9,
      note: `${tag} note`,
    })
  ).json;
  const chore = item(S, 'target', `${tag} Chore`);
  S = (await post('/api/item/save', { kind: 'target', name: `${tag} Retired`, pmin: 1, pmax: 1 }))
    .json;
  const retired = item(S, 'target', `${tag} Retired`);
  S = (await post('/api/item/save', { kind: 'challenge', name: `${tag} Challenge` })).json;
  const challenge = item(S, 'challenge', `${tag} Challenge`);
  await post('/api/reward/save', { name: `${tag} Prize`, stars: 1, points: 10 });
  await post('/api/add', { child_id: f.childId, item_id: retired.id });
  await post('/api/item/delete', { id: retired.id });
  await post('/api/add', {
    child_id: f.childId,
    item_id: chore.id,
    points: 7,
    note: `${tag} well done`,
  });
  S = (await post('/api/add', { child_id: sibling, item_id: chore.id })).json;
  await post('/api/warn', { child_id: f.childId, item_id: chore.id });
  await post('/api/mark', { child_id: f.childId, item_id: challenge.id, mark: 'perfect' });
  await post('/api/undo', { id: S.hist.find((h) => h.kind === 'points').id });
  const co = jar();
  const invite = await post('/api/invite/create', {});
  const coWho = {
    sub: `co-${tag}`,
    email: `co-${tag}@example.test`.toLowerCase(),
    name: `${tag} Coparent`,
  };
  assert.ok(
    (
      await srv.signIn(co, 'google', coWho, {
        invite: invite.json.issued.link.split('#invite=')[1],
      })
    ).ok,
  );
  const device = await srv.pairChild(f.jar, f.childId);
  const openInvite = await post('/api/invite/create', {});
  const openCode = await post('/api/pairing/create', { child_id: sibling });
  return {
    ...f,
    co,
    coWho,
    device,
    sibling,
    openInviteToken: openInvite.json.issued.link.split('#invite=')[1],
    openCode: openCode.json.issued.code,
    fid: familyId(srv, `${tag} Family`),
  };
}

/** Every secret-looking value stored for a family: hashes, tokens, subjects. */
function secretsOf(srv, F) {
  return srv.sql((db) => [
    ...db
      .prepare('SELECT token_hash h FROM sessions')
      .all()
      .map((r) => r.h),
    ...db
      .prepare('SELECT token_hash h FROM invites')
      .all()
      .map((r) => r.h),
    ...db
      .prepare('SELECT code_hash h FROM pairings')
      .all()
      .map((r) => r.h),
    ...db
      .prepare('SELECT subject s FROM users')
      .all()
      .map((r) => r.s),
    F.who.sub,
    F.coWho.sub,
    F.jar.c[SESSION],
    F.co.c[SESSION],
    F.device.jar.c[SESSION],
    F.openInviteToken,
    F.openCode,
    F.device.code,
  ]);
}

test('EX-01 export: the owner downloads the family as an attachment', async () => {
  const srv = await startServer({ signup: 'open' });
  try {
    const A = await build(srv, 'Alpha');
    const r = await srv.api(A.jar, '/api/export');
    assert.equal(r.status, 200, r.text);
    assert.match(r.headers.get('content-type'), /application\/json/);
    assert.match(
      r.headers.get('content-disposition'),
      /^attachment; filename="little-wins-\d{4}-\d{2}-\d{2}\.json"$/,
    );
    assert.equal(r.headers.get('cache-control'), 'no-store');
    const X = r.json;
    assert.equal(X.format, 'little-wins-export');
    assert.equal(X.family.name, 'Alpha Family');
    assert.equal(X.family.timezone, 'UTC');
    assert.deepEqual(X.children.map((c) => c.name).sort(), ['Alpha Kid', 'Alpha Sibling']);
    assert.ok(X.rewards.some((w) => w.name === 'Alpha Prize'));

    // Parents: names and roles, no tokens or hashes.
    assert.equal(X.parents.length, 2);
    assert.deepEqual(X.parents.map((p) => p.role).sort(), ['owner', 'parent']);
    for (const p of X.parents) {
      assert.deepEqual(Object.keys(p).sort(), ['account', 'name', 'provider', 'role']);
      assert.ok(/Parent|Coparent/.test(p.name));
    }

    // Items: both active and inactive ones.
    const names = X.items.map((i) => i.name);
    assert.ok(names.includes('Alpha Chore') && names.includes('Alpha Challenge'));
    const retired = X.items.find((i) => i.name === 'Alpha Retired');
    assert.ok(retired, 'an inactive item is exported');
    assert.equal(retired.active, 0);
    assert.equal(X.items.find((i) => i.name === 'Alpha Chore').note, 'Alpha note');
    assert.ok(X.items.length >= 3);

    // Entries: all of them, with the undone flag.
    const kinds = X.entries.map((e) => e.kind).sort();
    assert.ok(kinds.includes('points') && kinds.includes('warn') && kinds.includes('mark'));
    assert.ok(
      X.entries.some((e) => e.undone === 1),
      'an undone entry is exported, flagged',
    );
    assert.ok(X.entries.some((e) => e.undone === 0));
    const well = X.entries.find((e) => e.note === 'Alpha well done');
    assert.equal(well.points, 7);
    assert.ok(well.day && well.ts && well.child_id && well.item_id);
    assert.equal(
      X.entries.length,
      srv.sql((db) => db.prepare('SELECT COUNT(*) n FROM entries WHERE family_id=?').get(A.fid).n),
    );
  } finally {
    await srv.close();
  }
});

test('EX-02 export: only the owner (a co-parent or a child device is refused)', async () => {
  const srv = await startServer({ signup: 'open' });
  try {
    const A = await build(srv, 'Alpha');
    const co = await srv.api(A.co, '/api/export');
    assert.equal(co.status, 403);
    assert.ok(!co.text.includes('Alpha'), 'the refusal leaks nothing');
    const kid = await srv.api(A.device.jar, '/api/export');
    assert.equal(kid.status, 403);
    assert.ok(!kid.text.includes('Alpha'));
    assert.equal((await srv.api(null, '/api/export')).status, 401);
    // After a transfer the new owner can export and the old one cannot.
    const S = (await srv.api(A.jar, '/api/state')).json;
    const coId = S.parents.find((p) => !p.me).id;
    assert.equal((await srv.api(A.jar, '/api/owner/transfer', { user_id: coId })).status, 200);
    assert.equal((await srv.api(A.co, '/api/export')).status, 200);
    assert.equal((await srv.api(A.jar, '/api/export')).status, 403);
  } finally {
    await srv.close();
  }
});

test('EX-03 export: no hashes, tokens or account subjects, and nothing from another family', async () => {
  const srv = await startServer({ signup: 'open' });
  try {
    const A = await build(srv, 'Alpha');
    const B = await build(srv, 'Bravo');
    const text = (await srv.api(A.jar, '/api/export')).text;
    const secrets = secretsOf(srv, A).concat(secretsOf(srv, B));
    assert.ok(secrets.length > 15);
    for (const secret of secrets) {
      assert.ok(secret, 'every secret has a value');
      assert.ok(
        !text.includes(secret),
        `the export must not contain ${String(secret).slice(0, 8)}…`,
      );
    }
    for (const key of ['token', 'hash', 'subject', 'password', 'cookie', 'user_id'])
      assert.ok(!text.toLowerCase().includes(`"${key}`), `no "${key}…" field`);
    assert.ok(!text.includes('Bravo'), "none of family B's names");
    assert.ok(!text.includes(B.coWho.email) && !text.includes(B.who.email));
    const mine = JSON.parse(text);
    assert.equal(mine.family.name, 'Alpha Family');
    assert.equal(mine.children.length, 2);
    // B's own export is its own.
    const theirs = (await srv.api(B.jar, '/api/export')).text;
    assert.ok(theirs.includes('Bravo Prize') && !theirs.includes('Alpha'));
  } finally {
    await srv.close();
  }
});

// --- Family deletion -----------------------------------------------------------------------
test('EX-04 delete: only the owner may, and the confirmation must match the family name', async () => {
  const srv = await startServer({ signup: 'open' });
  try {
    const A = await build(srv, 'Alpha');
    for (const [who, label] of [
      [A.co, 'a co-parent'],
      [A.device.jar, 'a child device'],
    ]) {
      const r = await srv.api(who, '/api/family/delete', { confirm: 'Alpha Family' });
      assert.ok([403].includes(r.status), `${label}: ${r.status}`);
    }
    assert.equal(
      (await srv.api(null, '/api/family/delete', { confirm: 'Alpha Family' })).status,
      401,
    );
    for (const confirm of [
      undefined,
      '',
      'alpha family',
      'Alpha',
      'Alpha Family!',
      'Bravo Family',
      7,
      null,
    ]) {
      const r = await srv.api(A.jar, '/api/family/delete', { confirm });
      assert.equal(r.status, 400, `confirm=${JSON.stringify(confirm)}`);
      assert.match(r.json.error, /family name/);
    }
    assert.equal(familyId(srv, 'Alpha Family'), A.fid, 'still there');
    assert.equal((await srv.api(A.jar, '/api/state')).status, 200);
    // Surrounding spaces are forgiven.
    const ok = await srv.api(A.jar, '/api/family/delete', { confirm: '  Alpha Family  ' });
    assert.equal(ok.status, 200, ok.text);
  } finally {
    await srv.close();
  }
});

test('EX-05 delete: removes every row of the family and nothing else', async () => {
  const srv = await startServer({ signup: 'open' });
  try {
    const A = await build(srv, 'Alpha');
    const B = await build(srv, 'Bravo');
    const before = Object.fromEntries(FAMILY_TABLES.map((t) => [t, inFamily(srv, t, B.fid)]));
    for (const t of FAMILY_TABLES) assert.ok(before[t] > 0, `family B has ${t} to start with`);
    const bView = JSON.stringify((await srv.api(B.jar, '/api/state')).json);
    const usersBefore = srv.sql((db) => db.prepare('SELECT COUNT(*) n FROM users').get().n);
    assert.equal(usersBefore, 4);

    const r = await srv.api(A.jar, '/api/family/delete', { confirm: 'Alpha Family' });
    assert.equal(r.status, 200, r.text);
    assert.deepEqual(r.json, { ok: true, deleted: true });
    assert.equal(A.jar.c[SESSION], undefined, 'the session cookie was cleared');
    assert.match(r.headers.get('set-cookie'), /lw_session=;.*Max-Age=0/);

    assert.equal(
      srv.sql((db) => db.prepare('SELECT COUNT(*) n FROM families WHERE id=?').get(A.fid).n),
      0,
    );
    for (const t of FAMILY_TABLES)
      assert.equal(inFamily(srv, t, A.fid), 0, `${t} rows of the family`);
    assert.equal(
      srv.sql(
        (db) =>
          db
            .prepare(
              'SELECT COUNT(*) n FROM entries WHERE child_id NOT IN (SELECT id FROM children)',
            )
            .get().n,
      ),
      0,
      'no orphaned entries',
    );
    // Its parents are gone from users (they belong to no other family); B's stay.
    const left = srv.sql((db) =>
      db
        .prepare('SELECT subject FROM users ORDER BY id')
        .all()
        .map((u) => u.subject),
    );
    assert.deepEqual(left.sort(), [B.who.sub, B.coWho.sub].sort());
    assert.equal(
      srv.sql((db) => db.prepare('SELECT COUNT(*) n FROM families').get().n),
      1,
    );

    // Family B is untouched, byte for byte.
    for (const t of FAMILY_TABLES) assert.equal(inFamily(srv, t, B.fid), before[t], `B ${t}`);
    assert.equal(JSON.stringify((await srv.api(B.jar, '/api/state')).json), bView);
    assert.equal((await srv.api(B.co, '/api/state')).status, 200);
    assert.equal((await srv.api(B.device.jar, '/api/state')).status, 200);
  } finally {
    await srv.close();
  }
});

test('EX-06 delete: every session of the family stops working, and codes and invites are dead', async () => {
  const srv = await startServer({ signup: 'open' });
  try {
    const A = await build(srv, 'Alpha');
    const ownerCookie = A.jar.header;
    assert.equal(
      (await srv.api(A.jar, '/api/family/delete', { confirm: 'Alpha Family' })).status,
      200,
    );
    const stale = (c) => ({ header: c });
    assert.equal((await srv.api(A.device.jar, '/api/state')).status, 401, 'the child device');
    assert.equal((await srv.api(A.co, '/api/state')).status, 401, 'the co-parent');
    assert.equal(
      (await srv.api(stale(ownerCookie), '/api/state')).status,
      401,
      'the old owner cookie',
    );
    assert.equal(
      (await srv.api(jar(), '/api/pair', { code: A.openCode })).status,
      400,
      'an open pairing code',
    );
    assert.equal(
      (await srv.api(null, '/api/invite/info', { token: A.openInviteToken })).status,
      404,
    );
    const guest = jar();
    const r = await srv.signIn(guest, 'google', 'bob', { invite: A.openInviteToken });
    assert.ok(r.ok);
    assert.equal(
      (await srv.api(guest, '/api/state')).json.setup,
      true,
      'a dead invite joins nothing',
    );
  } finally {
    await srv.close();
  }
});

test('EX-07 delete: the owner can sign in again and set up a new family (when allowed)', async () => {
  const srv = await startServer({ signup: 'open' });
  try {
    const A = await build(srv, 'Alpha');
    assert.equal(
      (await srv.api(A.jar, '/api/family/delete', { confirm: 'Alpha Family' })).status,
      200,
    );
    const again = jar();
    const r = await srv.signIn(again, 'google', A.who);
    assert.ok(r.ok);
    const S = (await srv.api(again, '/api/state')).json;
    assert.equal(S.setup, true);
    assert.equal(S.canCreate, true);
    const setup = await srv.api(again, '/api/setup', {
      family_name: 'Fresh',
      child_name: 'New',
      timezone: 'UTC',
    });
    assert.equal(setup.status, 200);
    assert.deepEqual(
      setup.json.children.map((c) => c.name),
      ['New'],
    );
    assert.equal(setup.json.parents.length, 1, 'a new family has no trace of the old one');
  } finally {
    await srv.close();
  }
});

test('EX-08 delete: in a closed instance a deleted owner only gets setup if still allowlisted', async () => {
  const srv = await startServer({ allowlist: 'google:keep@example.test' });
  try {
    const who = { sub: 'keep-1', email: 'keep@example.test', name: 'Keeper' };
    const A = await srv.newFamily({ name: 'Closed Family', who });
    assert.equal(
      (await srv.api(A.jar, '/api/family/delete', { confirm: 'Closed Family' })).status,
      200,
    );
    const again = jar();
    assert.ok((await srv.signIn(again, 'google', who)).ok);
    const S = (await srv.api(again, '/api/state')).json;
    assert.deepEqual([S.setup, S.canCreate], [true, true]);
  } finally {
    await srv.close();
  }
});
