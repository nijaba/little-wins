/**
 * The JSON API. The family always comes from the session, never from the request; every ID
 * in a request goes through the family-scoped repo, so another family's IDs act as unknown.
 * Writes are POST with a JSON body from this site (see http.checkWrite).
 */
const config = require('./config');
const { today, validTimeZone } = require('./clock');
const { sendJson, readBody, checkWrite, apiError } = require('./http');
const i18n = require('./i18n');
const messages = require('./messages');
const scoring = require('./scoring');

const { validDay } = scoring;
const { buildState } = require('./state');
const { clearSessionCookie } = require('./sessions');
const { allows } = require('./allowlist');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path_ = require('node:path');

// The tour video is optional (made by scripts/tour-voiceover.py); hide its button without it.
const TOUR_VIDEO = path_.join(__dirname, '..', 'public', 'tour.mp4');
const hasTourVideo = () => fs.existsSync(TOUR_VIDEO);

// Clamp a request value to a whole number in [lo, hi]; text is trimmed and capped.
const num = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(+v) || 0));
const text = (v, max = 120) =>
  String(v ?? '')
    .trim()
    .slice(0, max);
const id = (v) => num(v, 0, 1e12);
const formatCode = (code) => code.replace(/(.{4})(.{4})(.{2})/, '$1-$2-$3');

// In a demo family these answer 403 demoOff (see docs/design.md, "Demo families").
const DEMO_OFF = new Set([
  '/api/pair',
  '/api/invite/info',
  '/api/signup/info',
  '/api/operator/invite/create',
  '/api/operator/invite/revoke',
  '/api/setup',
  '/api/logout',
  '/api/operator',
  '/api/export',
  '/api/invite/create',
  '/api/invite/revoke',
  '/api/parent/remove',
  '/api/owner/transfer',
  '/api/pairing/create',
  '/api/family/delete',
  '/api/session/revoke',
]);

/**
 * `demo` is set only for the demo families' router (server/demo.js): their own repo and
 * sessions, plus { idleSeconds, sweep, full, create, touch, leave }.
 */
function createRouter({ repo, sessions, limiter, clientIp, demo = null }) {
  /** [409, …] when the family already has as many of `what` as its limit allows, else null. */
  function full(fid, what, day) {
    if (repo.count(fid, what, day) < config.limits[what]) return null;
    return [409, apiError('limitReached', { limit: what })];
  }
  const isOperator = (userId) => {
    const who = userId ? repo.identityOf(userId) : null;
    return !!who && allows(config.operatorAllowlist, who);
  };
  const mayCreate = (userId) => {
    const who = repo.identityOf(userId);
    return (
      config.signupMode === 'open' ||
      (!!who && allows(config.allowlist, who)) ||
      (config.signupMode === 'invite' && repo.holdsFamilyInvite(userId))
    );
  };

  // Each handler gets ctx = { b (body), s (session), fid, state(extra?) } and returns
  // [status, json, headers?]. Handlers here are for parents of a family.
  const parentRoutes = {
    '/api/item/save'({ b, fid, state }) {
      const name = text(b.name);
      if (!name || !['target', 'penalty', 'challenge'].includes(b.kind)) {
        return [400, apiError('nameRequired')];
      }
      let pmin = num(b.pmin, 0, 10000);
      let pmax = num(b.pmax, 0, 10000);
      if (b.kind === 'challenge') pmin = pmax = 0;
      if (b.kind === 'penalty') pmax = pmin = Math.max(1, pmin);
      if (pmax < pmin) pmax = pmin;
      if (!b.id) {
        const limited = full(fid, 'items');
        if (limited) return limited;
      }
      const ok = repo.saveItem(fid, {
        id: b.id ? id(b.id) : 0,
        kind: b.kind,
        name,
        note: text(b.note),
        pmin,
        pmax,
      });
      return ok ? [200, state()] : [404, apiError('notFound')];
    },
    '/api/item/move': ({ b, fid, state }) => {
      repo.move(fid, 'items', id(b.id), +b.dir < 0 ? -1 : 1);
      return [200, state()];
    },
    '/api/item/delete': ({ b, fid, state }) =>
      repo.deleteItem(fid, id(b.id)) ? [200, state()] : [404, apiError('notFound')],

    '/api/reward/save'({ b, fid, state }) {
      const name = text(b.name);
      if (!name) return [400, apiError('nameRequired')];
      if (!b.id) {
        const limited = full(fid, 'rewards');
        if (limited) return limited;
      }
      const ok = repo.saveReward(fid, {
        id: b.id ? id(b.id) : 0,
        name,
        stars: num(b.stars, 0, 1000),
        points: num(b.points, 0, 100000),
      });
      return ok ? [200, state()] : [404, apiError('notFound')];
    },
    '/api/reward/move': ({ b, fid, state }) => {
      repo.move(fid, 'rewards', id(b.id), +b.dir < 0 ? -1 : 1);
      return [200, state()];
    },
    '/api/reward/delete': ({ b, fid, state }) =>
      repo.deleteReward(fid, id(b.id)) ? [200, state()] : [404, apiError('notFound')],

    '/api/add': (ctx) => record(ctx, 'add'),
    '/api/warn': (ctx) => record(ctx, 'warn'),
    '/api/mark': (ctx) => record(ctx, 'mark'),
    '/api/undo': ({ b, fid, state }) =>
      repo.undoEntry(fid, id(b.id)) ? [200, state()] : [404, apiError('notFound')],
    '/api/entry/note': ({ b, fid, state }) =>
      repo.setNote(fid, id(b.id), text(b.note)) ? [200, state()] : [404, apiError('notFound')],

    '/api/family/save'({ b, fid, state }) {
      const name = text(b.name, 60);
      if (!name) return [400, apiError('nameRequired')];
      if (!validTimeZone(b.timezone)) return [400, apiError('invalidTimeZone')];
      // An older page may not send a language: keep the family's.
      const language = b.language ?? repo.family(fid).language;
      if (!i18n.isLanguage(language)) return [400, apiError('invalidLanguage')];
      repo.updateFamily(fid, {
        name,
        timezone: b.timezone,
        weekStart: +b.week_start === 0 ? 0 : 1,
        language,
      });
      return [200, state()];
    },

    '/api/child/save'({ b, fid, state }) {
      const name = text(b.name, 40);
      if (!name) return [400, apiError('nameRequired')];
      if (b.id) {
        return repo.renameChild(fid, id(b.id), name) ? [200, state()] : [404, apiError('notFound')];
      }
      const limited = full(fid, 'children');
      if (limited) return limited;
      const cid = repo.addChild(fid, name);
      return [200, state({ child: cid })];
    },
    '/api/child/delete'({ b, fid, state }) {
      const cid = id(b.id);
      if (!repo.child(fid, cid)) return [404, apiError('notFound')];
      if (!repo.deleteChild(fid, cid)) return [400, apiError('lastChild')];
      return [200, state({ child: 0 })];
    },

    '/api/invite/create'({ s, fid, state }) {
      const { token, expires } = repo.createInvite(fid, s.userId, config.inviteMs);
      return [200, { ...state(), issued: { link: `${config.baseUrl}/#invite=${token}`, expires } }];
    },
    '/api/invite/revoke': ({ b, fid, state }) =>
      repo.revokeInvite(fid, id(b.id)) ? [200, state()] : [404, apiError('notFound')],

    '/api/parent/remove'({ b, s, fid, state }) {
      if (repo.role(fid, s.userId) !== 'owner') return [403, apiError('ownerOnly')];
      if (id(b.user_id) === s.userId) return [400, apiError('notYourself')];
      return repo.removeParent(fid, id(b.user_id)) ? [200, state()] : [404, apiError('notFound')];
    },
    '/api/owner/transfer'({ b, s, fid, state }) {
      if (repo.role(fid, s.userId) !== 'owner') return [403, apiError('ownerOnly')];
      if (id(b.user_id) === s.userId) return [400, apiError('notYourself')];
      return repo.transferOwner(fid, s.userId, id(b.user_id))
        ? [200, state()]
        : [404, apiError('notFound')];
    },

    '/api/pairing/create'({ b, s, fid, state }) {
      const cid = id(b.child_id);
      if (!repo.child(fid, cid)) return [404, apiError('notFound')];
      const limited = full(fid, 'devices');
      if (limited) return limited;
      const { code, expires } = repo.createPairing(fid, cid, s.userId, config.pairingMs);
      return [
        200,
        {
          ...state(),
          issued: { code: formatCode(code), link: `${config.baseUrl}/#pair=${code}`, expires },
        },
      ];
    },
    '/api/family/delete'({ b, s, fid }) {
      if (repo.role(fid, s.userId) !== 'owner') return [403, apiError('ownerOnly')];
      if (String(b.confirm ?? '').trim() !== repo.family(fid).name) {
        return [400, apiError('confirmFamilyName')];
      }
      repo.deleteFamily(fid);
      return [200, { ok: true, deleted: true }, { 'Set-Cookie': clearSessionCookie() }];
    },

    '/api/session/revoke'({ b, s, fid, state }) {
      const sid = id(b.id);
      if (!repo.revokeSession(fid, sid)) return [404, apiError('notFound')];
      if (sid === s.id) return [401, apiError('login'), { 'Set-Cookie': clearSessionCookie() }];
      return [200, state()];
    },
  };

  /** Points, warnings and marks for one child of the family. */
  function record({ b, s, fid, state }, kind) {
    const child = repo.child(fid, id(b.child_id));
    const item = repo.item(fid, id(b.item_id));
    if (!child || !item) return [404, apiError('notFound')];
    const day = today(repo.family(fid).timezone);
    const limited = full(fid, 'entriesPerDay', day);
    if (limited) return limited;
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
        if (!validDay(b.day) || b.day > day) return [400, apiError('invalidDay')];
        markDay = b.day;
      }
      repo.replaceMark(fid, child.id, item.id, markDay, b.mark, s.userId, who);
    } else {
      return [400, apiError('badRequest')];
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
        privacyUrl: config.privacyUrl || null,
        termsUrl: config.termsUrl || null,
        contactUrl: config.signupContactUrl || null,
        demo: config.demo.on,
        tourVideo: config.tourVideo && hasTourVideo(),
      },
    ];
  }

  /** A new demo family, opened as its parent. */
  function demoStart(req, b) {
    const wait = limiter.hit(`demo:${clientIp(req)}`);
    if (wait)
      return [429, apiError('tooManyTries', { seconds: wait }), { 'Retry-After': String(wait) }];
    if (demo.full()) return [503, apiError('demoFull'), { 'Retry-After': '300' }];
    const { familyId, userId } = demo.create(b);
    const { cookie } = sessions.create({ kind: 'parent', userId, familyId }, req);
    return [200, { ok: true }, { 'Set-Cookie': cookie }];
  }

  function pair(req, b) {
    const wait = limiter.hit(`pair:${clientIp(req)}`);
    if (wait)
      return [429, apiError('tooManyTries', { seconds: wait }), { 'Retry-After': String(wait) }];
    // Check the device limit before using the code up, so a refused code still works later.
    const found = repo.redeemPairing(b.code, (fid) => !full(fid, 'devices'));
    if (!found) return [400, apiError('codeInvalid')];
    if (found.refused) return full(found.familyId, 'devices');
    const { cookie } = sessions.create({ kind: 'child', ...found }, req);
    return [200, { ok: true }, { 'Set-Cookie': cookie }];
  }

  function inviteInfo(req, b) {
    const wait = limiter.hit(`invite:${clientIp(req)}`);
    if (wait)
      return [429, apiError('tooManyTries', { seconds: wait }), { 'Retry-After': String(wait) }];
    const invite = repo.findInvite(b.token);
    return invite ? [200, { familyName: invite.family_name }] : [404, apiError('inviteInvalid')];
  }

  /** Whether a family invite (#signup=…) still works, before its holder signs in. */
  function signupInfo(req, b) {
    const wait = limiter.hit(`invite:${clientIp(req)}`);
    if (wait)
      return [429, apiError('tooManyTries', { seconds: wait }), { 'Retry-After': String(wait) }];
    if (config.signupMode !== 'invite' || !repo.findFamilyInvite(b.token)) {
      return [404, apiError('inviteInvalid')];
    }
    return [200, { ok: true, full: repo.familiesFull() }];
  }

  /** The operator's numbers, with the open family invites and the cap on families. */
  const operatorReply = (extra = {}) => [
    200,
    {
      ...repo.operatorStats(),
      familyLimit: config.familyLimit,
      idleFamilyDays: config.idleFamilyDays,
      signupMode: config.signupMode,
      familyInvites: repo.familyInvites(),
      version: config.version,
      uptimeSeconds: Math.round(process.uptime()),
      ...extra,
    },
  ];

  function setup(req, s, b) {
    if (s.kind !== 'parent') return [403, apiError('viewOnly')];
    if (s.familyId != null || repo.membershipOf(s.userId)) return [409, apiError('setupDone')];
    if (!mayCreate(s.userId)) return [403, apiError('privateInstance')];
    if (repo.familiesFull()) return [409, apiError('serviceFull')];
    const familyName = text(b.family_name, 60);
    const childName = text(b.child_name, 40);
    if (!familyName || !childName) return [400, apiError('nameRequired')];
    if (!validTimeZone(b.timezone)) return [400, apiError('invalidTimeZone')];
    // Default: the browser's language.
    const language = b.language ?? i18n.fromAcceptLanguage(req.headers['accept-language']);
    if (!i18n.isLanguage(language)) return [400, apiError('invalidLanguage')];
    const fid = repo.createFamily({
      name: familyName,
      timezone: b.timezone,
      weekStart: +b.week_start === 0 ? 0 : 1,
      language,
      ownerId: s.userId,
      childName,
      starter: b.starter !== false,
    });
    repo.spendFamilyInvite(s.userId, fid);
    sessions.joinFamily(s.id, fid);
    const operator = isOperator(s.userId);
    return [
      200,
      { ...buildState(repo, { ...s, familyId: fid }, {}), ...(operator ? { operator: true } : {}) },
    ];
  }

  /** Handles one /api request. */
  return async function handle(req, res) {
    const send = (reply) => sendJson(res, ...reply);
    const url = new URL(req.url, 'http://x');
    const path = url.pathname;
    const view = { week: url.searchParams.get('week'), child: url.searchParams.get('child') };

    if (req.method === 'GET') {
      if (path === '/api/config') return send(publicConfig());
      if (!['/api/state', '/api/export', '/api/operator', '/api/review'].includes(path)) {
        return send([404, apiError('notFound')]);
      }
    } else if (req.method === 'POST') {
      if (
        ['/api/config', '/api/state', '/api/export', '/api/operator', '/api/review'].includes(path)
      ) {
        return send([405, apiError('badRequest'), { Allow: 'GET' }]);
      }
      const refused = checkWrite(req);
      if (refused) return send([refused[0], apiError(refused[1])]);
    } else {
      return send([405, apiError('badRequest'), { Allow: 'GET, POST' }]);
    }

    const b = await readBody(req);
    if (b === null) return send([413, apiError('tooLarge'), { Connection: 'close' }]);
    if (demo) {
      demo.sweep(); // idle demo families go before their sessions are looked at
      if (path === '/api/demo/start') return send(demoStart(req, b));
    } else if (path.startsWith('/api/demo/')) {
      return send([404, apiError('notFound')]);
    }
    if (!demo && path === '/api/pair') return send(pair(req, b));
    if (!demo && path === '/api/invite/info') return send(inviteInfo(req, b));
    if (!demo && path === '/api/signup/info') return send(signupInfo(req, b));

    const s = sessions.auth(req);
    if (!s && demo) {
      return send([401, apiError('demoEnded'), { 'Set-Cookie': sessions.clearCookie() }]);
    }
    if (!s) return send([401, apiError('login')]);
    if (demo) {
      demo.touch(s.familyId);
      if (DEMO_OFF.has(path)) return send([403, apiError('demoOff')]);
      if (path === '/api/demo/leave') {
        demo.leave(s.familyId);
        return send([200, { ok: true }, { 'Set-Cookie': sessions.clearCookie() }]);
      }
      if (path === '/api/demo/view') {
        if (b.as === 'child') {
          const child = repo.child(s.familyId, id(b.child_id));
          if (!child) return send([404, apiError('notFound')]);
          sessions.setView(s.id, 'child', child.id);
          Object.assign(s, { kind: 'child', childId: child.id });
        } else {
          sessions.setView(s.id, 'parent');
          Object.assign(s, { kind: 'parent', childId: null });
        }
        return send([200, buildState(repo, s, view, demo)]);
      }
    }
    if (path === '/api/logout') {
      sessions.end(s.id);
      return send([200, { ok: true }, { 'Set-Cookie': clearSessionCookie() }]);
    }
    if (path === '/api/setup') return send(setup(req, s, b));

    const operator = !demo && s.kind === 'parent' && isOperator(s.userId);
    if (path === '/api/operator' || path.startsWith('/api/operator/')) {
      if (!operator) return send([403, apiError('operatorOnly')]);
      if (path === '/api/operator') return send(operatorReply());
      if (path === '/api/operator/invite/create') {
        const { token, expires } = repo.createFamilyInvite(s.userId, config.familyInviteMs);
        return send(
          operatorReply({ issued: { link: `${config.baseUrl}/#signup=${token}`, expires } }),
        );
      }
      if (path === '/api/operator/invite/revoke') {
        return send(
          repo.revokeFamilyInvite(id(b.id)) ? operatorReply() : [404, apiError('notFound')],
        );
      }
      return send([404, apiError('notFound')]);
    }

    // A parent still setting up a family (or an operator without one) can only see that.
    if (s.familyId == null) {
      if (path === '/api/state') {
        const name = repo.user(s.userId)?.name || '';
        return send([
          200,
          {
            setup: true,
            role: 'parent',
            me: { userId: s.userId, name },
            canCreate: mayCreate(s.userId) && !repo.familiesFull(),
            full: repo.familiesFull(),
            operator,
          },
        ]);
      }
      return send([403, apiError('setupNotAllowed')]);
    }

    const state = (extra = {}) => ({
      ...buildState(repo, s, { ...view, ...extra }, demo),
      ...(operator ? { operator: true } : {}),
    });
    if (path === '/api/state') {
      // Unchanged since the page last asked? Then 304 and no body.
      const family = repo.family(s.familyId);
      const tag = `W/"${crypto
        .createHash('sha256')
        .update(
          [family.version, s.id, view.week, view.child, today(family.timezone), operator].join('|'),
        )
        .digest('base64url')
        .slice(0, 22)}"`;
      if (req.headers['if-none-match'] === tag) {
        res.writeHead(304, { ETag: tag, 'Cache-Control': 'no-cache' });
        return res.end();
      }
      return send([200, state(), { ETag: tag, 'Cache-Control': 'no-cache' }]);
    }
    if (s.kind !== 'parent') return send([403, apiError('viewOnly')]);
    if (path === '/api/review') {
      // The weekly review: one child of this family (another family's ID is unknown here).
      const fid = s.familyId;
      const child = view.child ? repo.child(fid, id(view.child)) : repo.children(fid)[0];
      if (!child) return send([404, apiError('notFound')]);
      const family = repo.family(fid);
      const range = scoring.weekRange(
        today(family.timezone),
        repo.firstEntryDay(fid, child.id),
        view.week,
        family.week_start,
      );
      const entries = repo.entries(fid, child.id);
      return send([
        200,
        {
          child: { id: child.id, name: child.name },
          ...range,
          ...scoring.review(entries, repo.items(fid), range.start, family.week_start),
        },
      ]);
    }
    if (path === '/api/export') {
      if (repo.role(s.familyId, s.userId) !== 'owner') return send([403, apiError('ownerOnly')]);
      const day = today(repo.family(s.familyId).timezone);
      return send([
        200,
        repo.exportFamily(s.familyId),
        { 'Content-Disposition': `attachment; filename="little-wins-${day}.json"` },
      ]);
    }

    const handler = parentRoutes[path];
    if (!handler) return send([404, apiError('notFound')]);
    const reply = handler({ b, s, fid: s.familyId, state });
    if (reply[0] === 200 && path !== '/api/family/delete') repo.bump(s.familyId);
    send(reply);
  };
}

module.exports = { createRouter };
