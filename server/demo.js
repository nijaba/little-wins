/**
 * Demo families (DEMO_FAMILIES=1): a private family per visitor, with no sign-in and made-up
 * history, so anyone can see the app working as a parent and as a child.
 *
 * They live in a second SQLite database held in memory, with the same migrations, data layer
 * and routes as real families, so a demo can never reach the database file, a backup, an export
 * or the operator's counts. A demo family is deleted after DEMO_IDLE_SECONDS without a request,
 * at most DEMO_MAX exist at once, and a restart ends them all. See docs/design.md, "Demo families".
 */
const config = require('./config');
const { today, validTimeZone } = require('./clock');
const i18n = require('./i18n');
const { shift, startOfWeek } = require('./scoring');
const { readCookie, randomToken } = require('./sessions');

// Calls that stay with the real router even while a demo cookie is set: they need no family.
const PUBLIC = ['/api/config', '/api/pair', '/api/invite/info', '/api/signup/info'];

/** A small seeded random generator (mulberry32), so every demo has the same history. */
function seeded(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Minutes the time zone is ahead of UTC at `ms`. */
function offsetMinutes(timeZone, ms) {
  const local = new Date(ms).toLocaleString('sv-SE', { timeZone }).replace(' ', 'T');
  return Math.round((Date.parse(`${local}Z`) - ms) / 60e3);
}

/** The UTC time (ISO) of a local clock time on a calendar day in a time zone. */
function localTime(timeZone, day, hour, minute) {
  const guess = Date.parse(
    `${day}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00Z`,
  );
  return new Date(guess - offsetMinutes(timeZone, guess) * 60e3).toISOString();
}

// Weeks (0 = three weeks ago … 2 = last week) and the challenges (by position) that win a star.
const WINS = { first: [[0, 1], [0, 2], [1]], second: [[], [0], [3]] };

/**
 * Creates one demo family with its parent, two children and three weeks of history before
 * today (plus today so far). Returns { familyId, userId }. Uses only the family-scoped repo.
 */
function seedDemo(repo, { timezone, language, now = Date.now() }) {
  const tz = validTimeZone(timezone) ? timezone : 'UTC';
  const lang = i18n.isLanguage(language) ? language : 'en';
  const names = i18n.demo(lang);
  const random = seeded(20261116);
  const pick = (n) => Math.floor(random() * n);

  const user = repo.upsertUser({ provider: 'demo', subject: randomToken(12), name: names.parent });
  const familyId = repo.createFamily({
    name: names.family,
    timezone: tz,
    weekStart: 1,
    language: lang,
    ownerId: user.id,
    childName: names.children[0],
    starter: true,
  });
  repo.addChild(familyId, names.children[1], '🐻');
  // The first child gets a fox, the second a bear (set with addChild above).
  repo.renameChild(familyId, repo.children(familyId)[0].id, names.children[0], '🦊');
  const kids = repo.children(familyId);
  const items = repo.items(familyId);
  const targets = items.filter((i) => i.kind === 'target');
  const penalty = items.find((i) => i.kind === 'penalty');
  const challenges = items.filter((i) => i.kind === 'challenge');

  const td = today(tz);
  const first = startOfWeek(shift(td, -21), 1);
  const nowIso = new Date(now).toISOString();
  const who = names.parent;
  const base = { userId: user.id, who };

  kids.forEach((child, n) => {
    const wins = n === 0 ? WINS.first : WINS.second;
    const rows = [];
    for (let day = first; day <= td; day = shift(day, 1)) {
      const week = Math.round((Date.parse(startOfWeek(day, 1)) - Date.parse(first)) / 6048e5);
      const index = Math.round((Date.parse(day) - Date.parse(startOfWeek(day, 1))) / 864e5);

      // Points: a few behaviors a day, in the morning and after school.
      const count = (n === 0 ? 3 : 2) + pick(3);
      const chosen = [...targets].sort(() => random() - 0.5).slice(0, count);
      const hours = [7, 8, 16, 17, 18, 19, 20].sort(() => random() - 0.5).slice(0, count);
      hours.sort((a, b) => a - b);
      chosen.forEach((item, k) => {
        const points = item.pmin + 5 * pick(Math.floor((item.pmax - item.pmin) / 5) + 1);
        rows.push({
          kind: 'points',
          item,
          points,
          day,
          ts: localTime(tz, day, hours[k], pick(50)),
        });
      });
      // The odd warning, and for the second child two penalties (parents see them; children never do).
      if (random() < (n === 0 ? 0.08 : 0.25)) {
        rows.push({
          kind: 'warn',
          item: targets[pick(targets.length)],
          points: 0,
          day,
          ts: localTime(tz, day, 18, 30),
        });
      }
      if (n === 1 && penalty && (day === shift(td, -12) || day === shift(td, -3))) {
        rows.push({
          kind: 'points',
          item: penalty,
          points: -penalty.pmin,
          day,
          ts: localTime(tz, day, 19, 15),
        });
      }

      // Marks: past weeks follow WINS; this week has one perfect day so far, and today is left
      // for the parent to mark.
      challenges.forEach((item, c) => {
        if (day === td) return;
        let mark;
        if (week < 3) {
          if (wins[week]?.includes(c))
            mark = index === 1 || index === 3 || random() < 0.4 ? 'perfect' : 'ok';
          else if (n === 1 && (c + week) % 2 === 0)
            mark = index === 2 ? 'bad' : random() < 0.4 ? 'perfect' : 'ok';
          else mark = index === 4 ? 'perfect' : 'ok';
        } else {
          mark = index === 0 ? 'perfect' : 'ok';
        }
        rows.push({ kind: 'mark', item, mark, day, ts: localTime(tz, day, 20, 30 + c) });
      });
    }
    rows
      .filter((r) => r.ts <= nowIso)
      .sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0))
      .forEach((r) => {
        if (r.kind === 'mark') {
          repo.replaceMark(familyId, child.id, r.item.id, r.day, r.mark, user.id, who, r.ts);
        } else {
          repo.addEntry(familyId, child.id, {
            ...base,
            itemId: r.item.id,
            kind: r.kind,
            points: r.points,
            day: r.day,
            ts: r.ts,
          });
        }
      });
  });
  // A message from the parent, so the child's view shows one (encouragement).
  repo.setMessage(familyId, kids[0].id, names.message, user.id, who);
  return { familyId, userId: user.id };
}

/**
 * The demo side of the app: its own in-memory database, data layer, sessions (cookie lw_demo)
 * and router. `wants(req, path)` says whether a request belongs to it.
 */
function createDemo({ limiter, clientIp }) {
  const db = require('./db').open(':memory:');
  const repo = require('./repo').createRepo(db);
  const name = config.cookies.demo;
  const sessions = require('./sessions').createSessions(db, {
    name,
    set: (token) => `${name}=${token}; ${config.cookies.demoAttrs}`,
    clear: () => `${name}=; ${config.cookies.demoAttrs}; Max-Age=0`,
  });

  // When each demo family was last used (ms). Its size is the number of demo families.
  const seen = new Map();
  const idleMs = config.demo.idleSeconds * 1000;
  function sweep() {
    const cutoff = Date.now() - idleMs;
    for (const [fid, at] of seen) {
      if (at >= cutoff) continue;
      repo.deleteFamily(fid);
      seen.delete(fid);
    }
  }
  setInterval(sweep, Math.min(60, config.demo.idleSeconds) * 1000).unref();

  const families = {
    idleSeconds: config.demo.idleSeconds,
    sweep,
    full: () => seen.size >= config.demo.max,
    create(b) {
      const made = seedDemo(repo, { timezone: b.timezone, language: b.language });
      seen.set(made.familyId, Date.now());
      return made;
    },
    touch: (fid) => seen.set(fid, Date.now()),
    leave(fid) {
      repo.deleteFamily(fid);
      seen.delete(fid);
    },
  };
  const handle = require('./routes').createRouter({
    repo,
    sessions,
    limiter,
    clientIp,
    demo: families,
  });

  const wants = (req, path) =>
    path.startsWith('/api/demo/') || (!!readCookie(req, name) && !PUBLIC.includes(path));

  return { handle, wants, count: () => seen.size };
}

module.exports = { createDemo, seedDemo, localTime };
