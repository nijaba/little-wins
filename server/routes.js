/**
 * The JSON API. The family always comes from the session, never from the request; every ID
 * in a request goes through the family-scoped repo, so another family's IDs act as unknown.
 * Writes are POST with a JSON body from this site (see http.checkWrite).
 */
const config = require('./config');
const { today, validTimeZone } = require('./clock');
const { sendJson, readBody, checkWrite } = require('./http');
const messages = require('./messages');
const { validDay } = require('./scoring');
const { buildState } = require('./state');
const { clearSessionCookie } = require('./sessions');

// Clamp a request value to a whole number in [lo, hi]; text is trimmed and capped.
const num = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(+v) || 0));
const text = (v, max = 120) =>
  String(v ?? '')
    .trim()
    .slice(0, max);
const id = (v) => num(v, 0, 1e12);
const formatCode = (code) => code.replace(/(.{4})(.{4})(.{2})/, '$1-$2-$3');

function createRouter({ repo, sessions, limiter, clientIp }) {
  // Each handler gets ctx = { b (body), s (session), fid, state(extra?) } and returns
  // [status, json, headers?]. Handlers here are for parents of a family.
  const parentRoutes = {
    '/api/item/save'({ b, fid, state }) {
      const name = text(b.name);
      if (!name || !['target', 'penalty', 'challenge'].includes(b.kind)) {
        return [400, { error: messages.nameRequired }];
      }
      let pmin = num(b.pmin, 0, 10000);
      let pmax = num(b.pmax, 0, 10000);
      if (b.kind === 'challenge') pmin = pmax = 0;
      if (b.kind === 'penalty') pmax = pmin = Math.max(1, pmin);
      if (pmax < pmin) pmax = pmin;
      const ok = repo.saveItem(fid, {
        id: b.id ? id(b.id) : 0,
        kind: b.kind,
        name,
        note: text(b.note),
        pmin,
        pmax,
      });
      return ok ? [200, state()] : [404, { error: messages.notFound }];
    },
    '/api/item/move': ({ b, fid, state }) => {
      repo.move(fid, 'items', id(b.id), +b.dir < 0 ? -1 : 1);
      return [200, state()];
    },
    '/api/item/delete': ({ b, fid, state }) =>
      repo.deleteItem(fid, id(b.id)) ? [200, state()] : [404, { error: messages.notFound }],

    '/api/reward/save'({ b, fid, state }) {
      const name = text(b.name);
      if (!name) return [400, { error: messages.nameRequired }];
      const ok = repo.saveReward(fid, {
        id: b.id ? id(b.id) : 0,
        name,
        stars: num(b.stars, 0, 1000),
        points: num(b.points, 0, 100000),
      });
      return ok ? [200, state()] : [404, { error: messages.notFound }];
    },
    '/api/reward/move': ({ b, fid, state }) => {
      repo.move(fid, 'rewards', id(b.id), +b.dir < 0 ? -1 : 1);
      return [200, state()];
    },
    '/api/reward/delete': ({ b, fid, state }) =>
      repo.deleteReward(fid, id(b.id)) ? [200, state()] : [404, { error: messages.notFound }],

    '/api/add': (ctx) => record(ctx, 'add'),
    '/api/warn': (ctx) => record(ctx, 'warn'),
    '/api/mark': (ctx) => record(ctx, 'mark'),
    '/api/undo': ({ b, fid, state }) =>
      repo.undoEntry(fid, id(b.id)) ? [200, state()] : [404, { error: messages.notFound }],

    '/api/family/save'({ b, fid, state }) {
      const name = text(b.name, 60);
      if (!name) return [400, { error: messages.nameRequired }];
      if (!validTimeZone(b.timezone)) return [400, { error: messages.invalidTimeZone }];
      repo.updateFamily(fid, {
        name,
        timezone: b.timezone,
        weekStart: +b.week_start === 0 ? 0 : 1,
      });
      return [200, state()];
    },

    '/api/child/save'({ b, fid, state }) {
      const name = text(b.name, 40);
      if (!name) return [400, { error: messages.nameRequired }];
      if (b.id) {
        return repo.renameChild(fid, id(b.id), name)
          ? [200, state()]
          : [404, { error: messages.notFound }];
      }
      const cid = repo.addChild(fid, name);
      return [200, state({ child: cid })];
    },
    '/api/child/delete'({ b, fid, state }) {
      const cid = id(b.id);
      if (!repo.child(fid, cid)) return [404, { error: messages.notFound }];
      if (!repo.deleteChild(fid, cid)) return [400, { error: messages.lastChild }];
      return [200, state({ child: 0 })];
    },

    '/api/invite/create'({ s, fid, state }) {
      const { token, expires } = repo.createInvite(fid, s.userId, config.inviteMs);
      return [200, { ...state(), issued: { link: `${config.baseUrl}/#invite=${token}`, expires } }];
    },
    '/api/invite/revoke': ({ b, fid, state }) =>
      repo.revokeInvite(fid, id(b.id)) ? [200, state()] : [404, { error: messages.notFound }],

    '/api/parent/remove'({ b, s, fid, state }) {
      if (repo.role(fid, s.userId) !== 'owner') return [403, { error: messages.ownerOnly }];
      if (id(b.user_id) === s.userId) return [400, { error: messages.notYourself }];
      return repo.removeParent(fid, id(b.user_id))
        ? [200, state()]
        : [404, { error: messages.notFound }];
    },
    '/api/owner/transfer'({ b, s, fid, state }) {
      if (repo.role(fid, s.userId) !== 'owner') return [403, { error: messages.ownerOnly }];
      if (id(b.user_id) === s.userId) return [400, { error: messages.notYourself }];
      return repo.transferOwner(fid, s.userId, id(b.user_id))
        ? [200, state()]
        : [404, { error: messages.notFound }];
    },

    '/api/pairing/create'({ b, s, fid, state }) {
      const cid = id(b.child_id);
      if (!repo.child(fid, cid)) return [404, { error: messages.notFound }];
      const { code, expires } = repo.createPairing(fid, cid, s.userId, config.pairingMs);
      return [
        200,
        {
          ...state(),
          issued: { code: formatCode(code), link: `${config.baseUrl}/#pair=${code}`, expires },
        },
      ];
    },
    '/api/session/revoke'({ b, s, fid, state }) {
      const sid = id(b.id);
      if (!repo.revokeSession(fid, sid)) return [404, { error: messages.notFound }];
      if (sid === s.id)
        return [401, { error: messages.login }, { 'Set-Cookie': clearSessionCookie() }];
      return [200, state()];
    },
  };

  /** Points, warnings and marks for one child of the family. */
  function record({ b, s, fid, state }, kind) {
    const child = repo.child(fid, id(b.child_id));
    const item = repo.item(fid, id(b.item_id));
    if (!child || !item) return [404, { error: messages.notFound }];
    const day = today(repo.family(fid).timezone);
    const who = repo.parents(fid).find((p) => p.id === s.userId)?.name || 'Parent';
    const base = { itemId: item.id, userId: s.userId, who };

    if (kind === 'add' && item.kind !== 'challenge' && item.active) {
      const points =
        item.kind === 'penalty'
          ? -item.pmin
          : Math.min(item.pmax, Math.max(item.pmin, +b.points || item.pmin));
      repo.addEntry(fid, child.id, { ...base, kind: 'points', points, note: text(b.note), day });
    } else if (kind === 'warn' && item.kind === 'target' && item.active) {
      repo.addEntry(fid, child.id, { ...base, kind: 'warn', points: 0, note: text(b.note), day });
    } else if (
      kind === 'mark' &&
      item.kind === 'challenge' &&
      ['perfect', 'ok', 'bad'].includes(b.mark)
    ) {
      let markDay = day;
      if (b.day) {
        if (!validDay(b.day) || b.day > day) return [400, { error: messages.invalidDay }];
        markDay = b.day;
      }
      repo.replaceMark(fid, child.id, item.id, markDay, b.mark, s.userId, who);
    } else {
      return [400, { error: messages.badRequest }];
    }
    return [200, state({ child: child.id })];
  }

  // --- Routes that work without a family (or without a session) -----------------------------

  function publicConfig() {
    return [
      200,
      {
        appName: messages.appName,
        providers: Object.keys(config.providers),
        signupMode: config.signupMode,
      },
    ];
  }

  function pair(req, b) {
    const wait = limiter.hit(`pair:${clientIp(req)}`);
    if (wait) return [429, { error: messages.tooManyTries(wait) }, { 'Retry-After': String(wait) }];
    const found = repo.redeemPairing(b.code);
    if (!found) return [400, { error: messages.codeInvalid }];
    const { cookie } = sessions.create({ kind: 'child', ...found }, req);
    return [200, { ok: true }, { 'Set-Cookie': cookie }];
  }

  function inviteInfo(req, b) {
    const wait = limiter.hit(`invite:${clientIp(req)}`);
    if (wait) return [429, { error: messages.tooManyTries(wait) }, { 'Retry-After': String(wait) }];
    const invite = repo.findInvite(b.token);
    return invite
      ? [200, { familyName: invite.family_name }]
      : [404, { error: messages.inviteInvalid }];
  }

  function setup(s, b) {
    if (s.kind !== 'parent') return [403, { error: messages.viewOnly }];
    if (s.familyId != null || repo.membershipOf(s.userId))
      return [409, { error: messages.setupDone }];
    const familyName = text(b.family_name, 60);
    const childName = text(b.child_name, 40);
    if (!familyName || !childName) return [400, { error: messages.nameRequired }];
    if (!validTimeZone(b.timezone)) return [400, { error: messages.invalidTimeZone }];
    const fid = repo.createFamily({
      name: familyName,
      timezone: b.timezone,
      weekStart: +b.week_start === 0 ? 0 : 1,
      ownerId: s.userId,
      childName,
      starter: b.starter !== false,
    });
    sessions.joinFamily(s.id, fid);
    return [200, buildState(repo, { ...s, familyId: fid }, {})];
  }

  /** Handles one /api request. */
  return async function handle(req, res) {
    const send = (reply) => sendJson(res, ...reply);
    const url = new URL(req.url, 'http://x');
    const path = url.pathname;
    const view = { week: url.searchParams.get('week'), child: url.searchParams.get('child') };

    if (req.method === 'GET') {
      if (path === '/api/config') return send(publicConfig());
      if (path !== '/api/state') return send([404, { error: messages.notFound }]);
    } else if (req.method === 'POST') {
      const refused = checkWrite(req);
      if (refused) return send([refused[0], { error: messages[refused[1]] }]);
    } else {
      return send([405, { error: messages.badRequest }, { Allow: 'GET, POST' }]);
    }

    const b = await readBody(req);
    if (b === null) return send([413, { error: messages.tooLarge }, { Connection: 'close' }]);
    if (path === '/api/pair') return send(pair(req, b));
    if (path === '/api/invite/info') return send(inviteInfo(req, b));

    const s = sessions.auth(req);
    if (!s) return send([401, { error: messages.login }]);
    if (path === '/api/logout') {
      sessions.end(s.id);
      return send([200, { ok: true }, { 'Set-Cookie': clearSessionCookie() }]);
    }
    if (path === '/api/setup') return send(setup(s, b));

    // A parent still setting up a family can only see that.
    if (s.familyId == null) {
      if (path === '/api/state') {
        const name = repo.user(s.userId)?.name || '';
        return send([200, { setup: true, role: 'parent', me: { userId: s.userId, name } }]);
      }
      return send([403, { error: messages.setupNotAllowed }]);
    }

    const state = (extra = {}) => buildState(repo, s, { ...view, ...extra });
    if (path === '/api/state') return send([200, state()]);
    if (s.kind !== 'parent') return send([403, { error: messages.viewOnly }]);

    const handler = parentRoutes[path];
    if (!handler) return send([404, { error: messages.notFound }]);
    send(handler({ b, s, fid: s.familyId, state }));
  };
}

module.exports = { createRouter };
