/**
 * Configuration from environment variables, read once at startup. `problems` lists anything
 * that must stop the app from starting; index.js prints them and exits. Nothing here touches
 * the database.
 */
const crypto = require('node:crypto');
const { parseAllowlist } = require('./allowlist');

const env = process.env;
const port = +env.PORT || 3000;
const problems = [];
const warnings = [];

// --- Where the app lives -------------------------------------------------------------
const baseUrl = (env.APP_BASE_URL || `http://localhost:${port}`).replace(/\/+$/, '');
let origin = '';
let isLocal = false;
try {
  const url = new URL(baseUrl);
  origin = url.origin;
  isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (!isLocal && url.protocol !== 'https:') {
    problems.push('APP_BASE_URL must start with https:// (only localhost may use http)');
  }
} catch {
  problems.push(`APP_BASE_URL is not a valid URL: ${baseUrl}`);
}

// --- Secret for signing the short-lived sign-in state cookie --------------------------
const PLACEHOLDERS = ['change-me', 'change-this-long-random-string'];
let sessionSecret = env.SESSION_SECRET || '';
if (!sessionSecret || PLACEHOLDERS.includes(sessionSecret) || sessionSecret.length < 32) {
  if (isLocal && !env.SESSION_SECRET) {
    sessionSecret = crypto.randomBytes(32).toString('hex');
    warnings.push(
      'SESSION_SECRET is not set; using a random one (sign-ins in progress end on restart)',
    );
  } else {
    problems.push('SESSION_SECRET must be at least 32 characters and not a placeholder');
  }
}

// --- Sign-in providers ----------------------------------------------------------------
const fakeSso = env.LITTLE_WINS_FAKE_SSO === '1';
if (fakeSso && !isLocal)
  problems.push('LITTLE_WINS_FAKE_SSO is only allowed when APP_BASE_URL is localhost');

const PROVIDERS = {
  google: {
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userinfoUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
    scope: 'openid email profile',
  },
  github: {
    authorizeUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userinfoUrl: 'https://api.github.com/user',
    scope: '',
  },
};

const providers = {};
for (const name of Object.keys(PROVIDERS)) {
  const id = env[`${name.toUpperCase()}_CLIENT_ID`];
  const secret = env[`${name.toUpperCase()}_CLIENT_SECRET`];
  if (fakeSso && isLocal) {
    // The fake provider stands in for both, served by this app (server/fake-sso.js).
    const fake = `${baseUrl}/_fake-sso/${name}`;
    providers[name] = {
      name,
      clientId: `fake-${name}`,
      clientSecret: 'fake-secret',
      authorizeUrl: `${fake}/authorize`,
      tokenUrl: `${fake}/token`,
      userinfoUrl: `${fake}/userinfo`,
      scope: PROVIDERS[name].scope,
      fake: true,
    };
  } else if (id && secret) {
    providers[name] = { name, clientId: id, clientSecret: secret, ...PROVIDERS[name] };
  } else if (id || secret) {
    problems.push(
      `${name.toUpperCase()}_CLIENT_ID and ${name.toUpperCase()}_CLIENT_SECRET must be set together`,
    );
  }
}
if (!Object.keys(providers).length) {
  if (isLocal)
    warnings.push(
      'No sign-in provider is configured; set LITTLE_WINS_FAKE_SSO=1 for local development',
    );
  else
    problems.push(
      'Configure at least one sign-in provider (GOOGLE_CLIENT_ID/SECRET or GITHUB_CLIENT_ID/SECRET)',
    );
}

// --- Who may create a family ----------------------------------------------------------
const signupMode = env.SIGNUP_MODE || 'closed';
if (!['closed', 'invite', 'open'].includes(signupMode)) {
  problems.push(`SIGNUP_MODE must be closed, invite or open (got "${signupMode}")`);
}
const allowlist = parseAllowlist(env.PARENT_ALLOWLIST || '');
for (const bad of allowlist.invalid)
  problems.push(`PARENT_ALLOWLIST has an entry it can't read: "${bad}"`);

// --- Who sees the operator page (counts and health; never family content) ---------------
const operatorAllowlist = parseAllowlist(env.OPERATOR_ALLOWLIST || '');
for (const bad of operatorAllowlist.invalid)
  problems.push(`OPERATOR_ALLOWLIST has an entry it can't read: "${bad}"`);

// --- Reverse proxies whose X-Forwarded-For / X-Forwarded-Proto we believe ----------------
const forwardedAllow = (env.FORWARDED_ALLOW_IPS || '')
  .split(',')
  .map((x) => x.trim())
  .filter(Boolean);

// --- Legal pages (hosted mode) --------------------------------------------------------
const legalUrl = (name) => {
  const value = env[name] || '';
  if (value && !/^https?:\/\/\S+$/.test(value)) problems.push(`${name} must be an http(s) URL`);
  return value;
};
const privacyUrl = legalUrl('PRIVACY_URL');
const termsUrl = legalUrl('TERMS_URL');

// --- Room for new families (hosted mode) -------------------------------------------------
// Whom a family without a place can ask: shown on the private and full pages.
const signupContactUrl = env.SIGNUP_CONTACT_URL || '';
if (signupContactUrl && !/^(https:\/\/|mailto:)\S+$/.test(signupContactUrl))
  problems.push('SIGNUP_CONTACT_URL must be an https:// or mailto: address');
// Evening reminders by Web Push (opt-in per parent device); PUSH_REMINDERS=0 turns them off.
if (env.PUSH_REMINDERS && !['0', '1'].includes(env.PUSH_REMINDERS))
  problems.push('PUSH_REMINDERS must be 0 or 1');
const push = env.PUSH_REMINDERS !== '0';
// Families no device has used for this many days are deleted (0: never).
let idleFamilyDays = 365;
if (env.DELETE_IDLE_FAMILIES_DAYS !== undefined && env.DELETE_IDLE_FAMILIES_DAYS !== '') {
  const n = Number(env.DELETE_IDLE_FAMILIES_DAYS);
  if (!Number.isInteger(n) || (n !== 0 && n < 30))
    problems.push('DELETE_IDLE_FAMILIES_DAYS must be 0 (never) or a whole number of at least 30');
  else idleFamilyDays = n;
}
// The most families this installation holds (null: no cap). Demo families never count.
let familyLimit = null;
if (env.LIMIT_FAMILIES !== undefined && env.LIMIT_FAMILIES !== '') {
  const n = Number(env.LIMIT_FAMILIES);
  if (!Number.isInteger(n) || n < 1)
    problems.push('LIMIT_FAMILIES must be a whole number of at least 1');
  else familyLimit = n;
}

// --- Emails to the operator (sign-ups, the limit reached, a parent turned away, deletions) ---
// Counts only: no family name or email is ever sent. Off unless NOTIFY_EMAIL is set.
const NOTIFY_EVENT_NAMES = ['signup', 'full', 'turned-away', 'deleted'];
const emailLike = (v) => /^[^\s@,<>]+@[^\s@,<>]+\.[^\s@,<>]+$/.test(v);
const csv = (v) =>
  String(v ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
let notify = null;
if (env.NOTIFY_EMAIL) {
  const to = csv(env.NOTIFY_EMAIL);
  if (!to.length || !to.every(emailLike))
    problems.push('NOTIFY_EMAIL must be one or more email addresses, separated by commas');
  const events = env.NOTIFY_EVENTS ? csv(env.NOTIFY_EVENTS) : NOTIFY_EVENT_NAMES;
  const unknown = events.filter((e) => !NOTIFY_EVENT_NAMES.includes(e));
  if (unknown.length)
    problems.push(
      `NOTIFY_EVENTS: unknown ${unknown.join(', ')} (use ${NOTIFY_EVENT_NAMES.join(', ')})`,
    );
  for (const name of ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'])
    if (!env[name]) problems.push(`${name} is required when NOTIFY_EMAIL is set`);
  const host = env.SMTP_HOST || '';
  const port = env.SMTP_PORT ? Number(env.SMTP_PORT) : 465;
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    problems.push('SMTP_PORT must be a port number');
  const tlsMode = env.SMTP_TLS || (port === 465 ? 'tls' : 'starttls');
  if (!['tls', 'starttls', 'none'].includes(tlsMode))
    problems.push('SMTP_TLS must be tls, starttls or none');
  // Without TLS the password would cross the network in the clear: only to this machine.
  if (tlsMode === 'none' && !['localhost', '127.0.0.1', '::1'].includes(host))
    problems.push('SMTP_TLS=none is only allowed when SMTP_HOST is localhost');
  const from = env.SMTP_FROM || env.SMTP_USER || '';
  if (from && !emailLike(from)) problems.push('SMTP_FROM must be an email address');
  notify = {
    to,
    events: new Set(events),
    smtp: { host, port, tls: tlsMode, user: env.SMTP_USER, pass: env.SMTP_PASS, from },
  };
}

// --- Per-family limits: generous for a self-hosted family, tighter when sign-up is open ---
const LIMIT_DEFAULTS = {
  closed: { children: 20, parents: 10, items: 500, rewards: 200, devices: 50, entriesPerDay: 2000 },
  open: { children: 8, parents: 6, items: 200, rewards: 100, devices: 30, entriesPerDay: 500 },
};
const LIMIT_ENV = {
  children: 'LIMIT_CHILDREN',
  parents: 'LIMIT_PARENTS',
  items: 'LIMIT_ITEMS',
  rewards: 'LIMIT_REWARDS',
  devices: 'LIMIT_DEVICES',
  entriesPerDay: 'LIMIT_ENTRIES_PER_DAY',
};
// Hosted modes (open, invite) get the tighter defaults; a self-hosted family (closed) the generous ones.
const limits = { ...(signupMode === 'closed' ? LIMIT_DEFAULTS.closed : LIMIT_DEFAULTS.open) };
for (const [key, name] of Object.entries(LIMIT_ENV)) {
  if (env[name] === undefined || env[name] === '') continue;
  const n = Number(env[name]);
  if (!Number.isInteger(n) || n < 1) problems.push(`${name} must be a whole number of at least 1`);
  else limits[key] = n;
}

// --- Demo families (memory only) and the tour video -------------------------------------
const wholeNumber = (name, fallback) => {
  if (env[name] === undefined || env[name] === '') return fallback;
  const n = Number(env[name]);
  if (Number.isInteger(n) && n >= 1) return n;
  problems.push(`${name} must be a whole number of at least 1`);
  return fallback;
};
if (env.DEMO_FAMILIES && !['0', '1'].includes(env.DEMO_FAMILIES))
  problems.push('DEMO_FAMILIES must be 0 or 1');
if (env.TOUR_VIDEO && !['0', '1'].includes(env.TOUR_VIDEO))
  problems.push('TOUR_VIDEO must be 0 or 1');
const demo = {
  on: env.DEMO_FAMILIES === '1',
  max: wholeNumber('DEMO_MAX', 20),
  idleSeconds: wholeNumber('DEMO_IDLE_SECONDS', 1800),
};

module.exports = {
  port,
  baseUrl,
  origin,
  isLocal,
  sessionSecret,
  providers,
  fakeSso: fakeSso && isLocal,
  signupMode,
  allowlist,
  operatorAllowlist,
  forwardedAllow,
  privacyUrl,
  termsUrl,
  signupContactUrl,
  familyLimit,
  idleFamilyDays,
  notify,
  push,
  // How often reminders are checked (tests make it shorter).
  pushIntervalMs: Math.max(100, Number(env.PUSH_INTERVAL_MS) || 60e3),
  limits,
  demo,
  tourVideo: env.TOUR_VIDEO !== '0',
  version: (() => {
    try {
      return require('../package.json').version;
    } catch {
      return 'unknown';
    }
  })(),
  dbPath: env.DATABASE_PATH || env.DB || '/data/little-wins.db',
  problems,
  warnings,

  // Request bodies are tiny JSON; anything larger is refused.
  maxBody: 10240,

  cookies: {
    session: 'lw_session',
    demo: 'lw_demo', // a demo family's session; ends with the browser (no Max-Age)
    demoAttrs: `Path=/; HttpOnly; SameSite=Strict${isLocal ? '' : '; Secure'}`,
    state: 'lw_oauth',
    attrs: `Path=/; HttpOnly; SameSite=Lax${isLocal ? '' : '; Secure'}`,
    sessionMaxAge: 365 * 24 * 3600, // seconds
    stateMaxAge: 600,
  },

  sessionIdleMs: 365 * 864e5, // sessions unused this long are deleted
  lastSeenThrottleMs: 5 * 60e3,
  inviteMs: 7 * 864e5,
  familyInviteMs: 30 * 864e5,
  pairingMs: 10 * 60e3,

  // Per-client limits for sign-in and code redemption: max requests per window.
  rateLimit: { max: 10, windowMs: 60e3 },
  // Per-client limits for every API request.
  apiRateLimit: { reads: 600, writes: 120, windowMs: 60e3 },
};
