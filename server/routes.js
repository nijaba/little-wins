/** The JSON API: login, state, and the parent-only editing and recording routes. */
const config = require('./config');
const { today } = require('./clock');
const { sendJson, readBody } = require('./http');
const messages = require('./messages');
const { validDay } = require('./scoring');
const { buildState } = require('./state');

const clearCookie = `${config.cookieName}=; ${config.cookieAttrs}; Max-Age=0`;

// Clamp a request value to a whole number in [lo, hi]; text is trimmed and capped at 120 chars.
const num = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(+v) || 0));
const text = (v) =>
  String(v || '')
    .trim()
    .slice(0, 120);

function createRouter({ db, sessions, lockout }) {
  const { newSession, auth } = sessions;

  // Each handler gets { b (body), role, sid, state() } and returns a reply: [status, json, headers?].
  // Returning nothing means "bad request".
  const parentRoutes = {
    '/api/item/save'({ b, state }) {
      const name = text(b.name);
      const note = text(b.note);
      if (!name || !['target', 'penalty', 'challenge'].includes(b.kind)) {
        return [400, { error: messages.nameRequired }];
      }
      let pmin = num(b.pmin, 0, 10000);
      let pmax = num(b.pmax, 0, 10000);
      if (b.kind === 'challenge') pmin = pmax = 0;
      if (b.kind === 'penalty') {
        pmin = Math.max(1, pmin);
        pmax = pmin;
      }
      if (pmax < pmin) pmax = pmin;
      if (b.id) {
        db.prepare('UPDATE items SET name=?,note=?,pmin=?,pmax=? WHERE id=? AND kind=?').run(
          name,
          note,
          pmin,
          pmax,
          num(b.id, 0, 1e9),
          b.kind,
        );
      } else {
        const next = db.prepare('SELECT COALESCE(MAX(sort),0)+1 s FROM items').get().s;
        db.prepare(
          'INSERT INTO items(kind,name,note,pmin,pmax,sort,active) VALUES(?,?,?,?,?,?,1)',
        ).run(b.kind, name, note, pmin, pmax, next);
      }
      return [200, state()];
    },

    '/api/item/move': (ctx) => move(ctx, 'items'),
    '/api/reward/move': (ctx) => move(ctx, 'rewards'),

    '/api/item/delete'({ b, state }) {
      db.prepare('UPDATE items SET active=0 WHERE id=?').run(num(b.id, 0, 1e9));
      return [200, state()];
    },

    '/api/reward/save'({ b, state }) {
      const name = text(b.name);
      if (!name) return [400, { error: messages.nameRequired }];
      const stars = num(b.stars, 0, 1000);
      const points = num(b.points, 0, 100000);
      if (b.id) {
        db.prepare('UPDATE rewards SET name=?,stars=?,points=? WHERE id=?').run(
          name,
          stars,
          points,
          num(b.id, 0, 1e9),
        );
      } else {
        db.prepare(
          'INSERT INTO rewards(name,stars,points,sort) VALUES(?,?,?,(SELECT COALESCE(MAX(sort),0)+1 FROM rewards))',
        ).run(name, stars, points);
      }
      return [200, state()];
    },

    '/api/reward/delete'({ b, state }) {
      db.prepare('DELETE FROM rewards WHERE id=?').run(num(b.id, 0, 1e9));
      return [200, state()];
    },

    '/api/settings/save'({ b, state }) {
      db.prepare(
        'INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
      ).run(
        'child_name',
        String(b.child_name || '')
          .trim()
          .slice(0, 40),
      );
      return [200, state()];
    },

    '/api/session/revoke'({ b, sid, state }) {
      const id = num(b.id, 0, 1e9);
      db.prepare('DELETE FROM sessions WHERE id=?').run(id);
      if (id === sid) return [401, { error: messages.login }, { 'Set-Cookie': clearCookie }];
      return [200, state()];
    },

    '/api/undo'({ b, state }) {
      db.prepare('UPDATE entries SET undone=1 WHERE id=?').run(+b.id);
      return [200, state()];
    },
  };

  // Moves an item (within its kind) or a reward one place up (dir < 0) or down.
  function move({ b, state }, table) {
    const dir = +b.dir < 0 ? -1 : 1;
    const id = num(b.id, 0, 1e9);
    const row = db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(id);
    if (row) {
      const list =
        table === 'rewards'
          ? db.prepare('SELECT id FROM rewards ORDER BY sort,id').all()
          : db
              .prepare('SELECT id FROM items WHERE active=1 AND kind=? ORDER BY sort,id')
              .all(row.kind);
      const from = list.findIndex((x) => x.id === id);
      const to = from + dir;
      if (from >= 0 && to >= 0 && to < list.length) {
        list.splice(to, 0, list.splice(from, 1)[0]);
        list.forEach((x, k) => {
          db.prepare(`UPDATE ${table} SET sort=? WHERE id=?`).run(k + 1, x.id);
        });
      }
    }
    return [200, state()];
  }

  // Recording points, warnings and marks against an item.
  function recordRoute(path, { b, state }) {
    const ts = new Date().toISOString();
    const day = today();
    const itemId = Number.isInteger(+b.item_id) && b.item_id != null ? +b.item_id : -1;
    const item = db.prepare('SELECT * FROM items WHERE id=?').get(itemId);
    const add = (kind, points, note, d = day) =>
      db
        .prepare('INSERT INTO entries(ts,day,item_id,kind,points,who,note) VALUES(?,?,?,?,?,?,?)')
        .run(ts, d, b.item_id, kind, points, 'Parent', note || '');

    if (path === '/api/add' && item && item.kind !== 'challenge') {
      const points =
        item.kind === 'penalty'
          ? -item.pmin
          : Math.min(item.pmax, Math.max(item.pmin, +b.points || item.pmin));
      add('points', points, b.note);
    } else if (path === '/api/warn' && item && item.kind === 'target') {
      add('warn', 0, b.note);
    } else if (
      path === '/api/mark' &&
      item &&
      item.kind === 'challenge' &&
      ['perfect', 'ok', 'bad'].includes(b.mark)
    ) {
      let markDay = day;
      if (b.day) {
        if (!validDay(b.day) || b.day > day) return [400, { error: messages.invalidDay }];
        markDay = b.day;
      }
      db.prepare("UPDATE entries SET undone=1 WHERE kind='mark' AND item_id=? AND day=?").run(
        b.item_id,
        markDay,
      );
      add('mark', 0, b.mark, markDay);
    } else {
      return [400, { error: messages.badRequest }];
    }
    return [200, state()];
  }

  function login(req, b) {
    const now = Date.now();
    const wait = lockout.remaining(now);
    if (wait) return [429, { error: messages.tooManyPins(wait) }];
    const role = b.pin === config.parentPin ? 'parent' : b.pin === config.childPin ? 'child' : null;
    if (!role) {
      lockout.fail(now);
      return [401, { error: messages.wrongPin }];
    }
    lockout.reset();
    return [200, { role }, { 'Set-Cookie': newSession(role, req).cookie }];
  }

  /** Handles one /api request (or any non-GET request). */
  return async function handle(req, res) {
    const send = (reply) => sendJson(res, ...reply);
    const url = new URL(req.url, 'http://x');
    const path = url.pathname;
    const week = url.searchParams.get('week');

    const b = await readBody(req);
    if (b === null) return send([413, { error: messages.tooLarge }, { Connection: 'close' }]);
    if (path === '/api/login') return send(login(req, b));

    const session = auth(req);
    if (!session) return send([401, { error: messages.login }]);
    const { role, sid } = session;
    const state = () => buildState(db, role, sid, week);
    if (path === '/api/state') return send([200, state()]);
    if (role !== 'parent') return send([403, { error: messages.viewOnly }]);

    const ctx = { b, role, sid, state };
    const handler = parentRoutes[path];
    send(handler ? handler(ctx) : recordRoute(path, ctx));
  };
}

module.exports = { createRouter };
