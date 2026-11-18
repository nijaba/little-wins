/**
 * Settings the operator can change on the dashboard (see docs/design.md, "The operator").
 *
 * Each one starts from .env (or its default), as config.js read it. A change on the dashboard is
 * stored in the `settings` table and wins over .env, now and after a restart, until the operator
 * resets it. Secrets, sign-in, addresses, the operator list and anything only read at startup
 * are never here.
 *
 * Values travel as the strings .env would hold; `parse` checks one and returns what config
 * holds, or throws a message for the operator.
 */
const config = require('./config');
const { parseAllowlist } = require('./allowlist');

const csv = (v) =>
  String(v ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
const NOTIFY_EVENT_NAMES = ['signup', 'full', 'turned-away', 'deleted'];

/** A whole number of at least `min`; '' gives `empty`. */
const whole = (min, empty, message) => (raw) => {
  if (raw === '') return empty;
  const n = Number(raw);
  if (!/^\d+$/.test(raw) || !Number.isInteger(n) || n < min) throw new Error(message);
  return n;
};
const url = (pattern, message) => (raw) => {
  if (raw && !pattern.test(raw)) throw new Error(message);
  return raw;
};
const bool = (fallback) => (raw) => {
  if (raw === '') return fallback;
  if (raw !== '0' && raw !== '1') throw new Error('Must be 0 (off) or 1 (on)');
  return raw === '1';
};

/** The per-family limits for a sign-up mode, before any LIMIT_* setting. */
const modeLimits = (mode) =>
  mode === 'closed' ? config.LIMIT_DEFAULTS.closed : config.LIMIT_DEFAULTS.open;

const LIMIT_LABELS = {
  children: 'Children per family',
  parents: 'Parents per family',
  items: 'Behaviors, penalties and challenges per family',
  rewards: 'Rewards per family',
  devices: 'Devices per family',
  entriesPerDay: 'Entries per family per day',
};

const DEFS = [
  {
    key: 'SIGNUP_MODE',
    group: 'Sign-up and places',
    label: 'Who may create a family',
    help: 'closed: only PARENT_ALLOWLIST; invite: with a family invite from this page; open: anyone who signs in.',
    type: 'choice',
    choices: ['closed', 'invite', 'open'],
    parse(raw) {
      const v = raw || 'closed';
      if (!this.choices.includes(v)) throw new Error('Must be closed, invite or open');
      return v;
    },
    apply: (v) => {
      config.signupMode = v;
    },
  },
  {
    key: 'LIMIT_FAMILIES',
    group: 'Sign-up and places',
    label: 'Most families',
    help: 'New families are refused at this number (demo families never count). Empty: no cap.',
    type: 'number',
    parse: whole(1, null, 'Must be empty (no cap) or a whole number of at least 1'),
    apply: (v) => {
      config.familyLimit = v;
    },
  },
  {
    key: 'SIGNUP_CONTACT_URL',
    group: 'Sign-up and places',
    label: '"Ask for a place" link',
    help: 'Shown on the private and full pages. An https:// or mailto: address; empty: none.',
    type: 'text',
    parse: url(/^(https:\/\/|mailto:)\S+$/, 'Must be empty, or an https:// or mailto: address'),
    apply: (v) => {
      config.signupContactUrl = v;
    },
  },
  {
    key: 'DELETE_IDLE_FAMILIES_DAYS',
    group: 'Sign-up and places',
    label: 'Delete families unused for (days)',
    help: '0: never. Otherwise at least 30. Families see the rule in Settings.',
    type: 'number',
    parse(raw) {
      if (raw === '') return 365;
      const n = Number(raw);
      if (!/^\d+$/.test(raw) || (n !== 0 && n < 30))
        throw new Error('Must be 0 (never) or a whole number of at least 30');
      return n;
    },
    apply: (v) => {
      config.idleFamilyDays = v;
    },
  },
  {
    key: 'PARENT_ALLOWLIST',
    group: 'Who may create a family',
    label: 'Parent allowlist',
    help: 'Comma-separated: a verified Google email, github:login, or @domain. These accounts may always create a family.',
    type: 'text',
    parse(raw) {
      const list = parseAllowlist(raw);
      if (list.invalid.length) throw new Error(`Can't read: ${list.invalid.join(', ')}`);
      return list;
    },
    apply: (v) => {
      config.allowlist = v;
    },
  },
  ...Object.entries(config.LIMIT_ENV).map(([limit, key]) => ({
    key,
    group: 'Per-family limits',
    label: LIMIT_LABELS[limit],
    help: 'Empty: the default for the sign-up mode.',
    type: 'number',
    limit,
    parse: whole(1, null, 'Must be empty (the default) or a whole number of at least 1'),
    apply: (v) => {
      config.limits[limit] = v ?? modeLimits(config.signupMode)[limit];
    },
  })),
  {
    key: 'PRIVACY_URL',
    group: 'Pages, emails and video',
    label: 'Privacy policy',
    help: 'Linked from the sign-in page and Settings. An http(s) address; empty: none.',
    type: 'text',
    parse: url(/^https?:\/\/\S+$/, 'Must be empty or an http(s) address'),
    apply: (v) => {
      config.privacyUrl = v;
    },
  },
  {
    key: 'TERMS_URL',
    group: 'Pages, emails and video',
    label: 'Terms',
    help: 'Linked from the sign-in page and Settings. An http(s) address; empty: none.',
    type: 'text',
    parse: url(/^https?:\/\/\S+$/, 'Must be empty or an http(s) address'),
    apply: (v) => {
      config.termsUrl = v;
    },
  },
  {
    key: 'NOTIFY_EVENTS',
    group: 'Pages, emails and video',
    label: 'Operator emails',
    help: 'Which emails go to NOTIFY_EMAIL. The recipients and the mail server stay in .env.',
    type: 'events',
    choices: NOTIFY_EVENT_NAMES,
    // Only when emails are on: NOTIFY_EMAIL and the mail server are set in .env.
    available: () => !!config.notify,
    parse(raw) {
      const events = raw === '' ? NOTIFY_EVENT_NAMES : csv(raw);
      const unknown = events.filter((e) => !NOTIFY_EVENT_NAMES.includes(e));
      if (unknown.length) throw new Error(`Unknown: ${unknown.join(', ')}`);
      return new Set(events);
    },
    apply: (v) => {
      if (config.notify) config.notify.events = v;
    },
  },
  {
    key: 'TOUR_VIDEO',
    group: 'Pages, emails and video',
    label: 'Watch the video',
    help: 'Offers the tour video on the sign-in page.',
    type: 'bool',
    parse: bool(true),
    apply: (v) => {
      config.tourVideo = v;
    },
  },
];
const BY_KEY = new Map(DEFS.map((d) => [d.key, d]));

/** What .env says for a key ('' when unset). config.js already refused a bad one at startup. */
const envRaw = (key) => String(process.env[key] ?? '').trim();

function createSettings({ repo }) {
  const stored = () => new Map(repo.settings().map((r) => [r.key, r]));
  const raw = new Map(); // key -> the value in force, as a string

  function applyAll() {
    const rows = stored();
    // The mode first: the per-family limits' defaults depend on it.
    const order = [...DEFS].sort((a, b) =>
      a.key === 'SIGNUP_MODE' ? -1 : b.key === 'SIGNUP_MODE' ? 1 : 0,
    );
    for (const d of order) {
      const row = rows.get(d.key);
      let value = row ? row.value : envRaw(d.key);
      let parsed;
      try {
        parsed = d.parse(value);
      } catch (err) {
        // A stored value an older or newer version can't read: fall back to .env, and say so.
        console.warn(`Ignoring the dashboard's ${d.key}: ${err.message}`);
        value = envRaw(d.key);
        parsed = d.parse(value);
      }
      d.apply(parsed);
      raw.set(d.key, value);
    }
  }

  /** Every setting, with the value in force, where it comes from and the .env value. */
  function list() {
    const rows = stored();
    return DEFS.filter((d) => !d.available || d.available()).map((d) => {
      const row = rows.get(d.key);
      return {
        key: d.key,
        group: d.group,
        label: d.label,
        help: d.help,
        type: d.type,
        ...(d.choices ? { choices: d.choices } : {}),
        value: raw.get(d.key) ?? '',
        env: envRaw(d.key),
        source: row ? 'dashboard' : envRaw(d.key) ? 'env' : 'default',
        ...(row ? { updated: row.updated } : {}),
        ...(d.limit ? { modeDefault: modeLimits(config.signupMode)[d.limit] } : {}),
      };
    });
  }

  /** Change one setting: null when it isn't one, or { error } when the value is refused. */
  function set(key, value, userId) {
    const d = BY_KEY.get(key);
    if (!d || (d.available && !d.available())) return null;
    const v = String(value ?? '').trim();
    if (v.length > 2000) return { error: 'Too long' };
    try {
      d.parse(v);
    } catch (err) {
      return { error: err.message };
    }
    repo.setSetting(key, v, userId);
    applyAll();
    return { ok: true };
  }

  /** Back to .env (or the default). */
  function reset(key) {
    if (!BY_KEY.has(key)) return null;
    repo.clearSetting(key);
    applyAll();
    return { ok: true };
  }

  applyAll();
  return { list, set, reset, applyAll };
}

module.exports = { createSettings, DEFS };
