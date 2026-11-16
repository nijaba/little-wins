/**
 * Configuration: environment variables, constants, and the startup check that refuses
 * placeholder or weak secrets. Nothing here touches the database.
 */
const messages = require('./messages');

const PLACEHOLDERS = ['1234', '0000', 'change-me', 'change-this-long-random-string'];

const config = {
  parentPin: process.env.PARENT_PIN || '1234',
  childPin: process.env.CHILD_PIN || '0000',
  secret: process.env.SECRET || 'change-me',
  dbPath: process.env.DB || '/data/little-wins.db',
  port: +process.env.PORT || 3000,
  allowDefaults: process.env.ALLOW_DEFAULTS === '1',

  // Request bodies are tiny JSON; anything larger is refused.
  maxBody: 10240,

  cookieName: 't',
  cookieAttrs: 'Path=/; HttpOnly; SameSite=Strict',
  cookieMaxAge: 31536000, // one year, in seconds

  sessionIdleMs: 365 * 864e5, // sessions unused this long are deleted
  lastSeenThrottleMs: 5 * 60e3,

  // Global (not per-IP) throttle: behind a reverse proxy every request comes from the proxy.
  // Free tries, then 30s, 60s, ... up to 15 minutes.
  lockout: { freeTries: 5, baseMs: 30e3, maxMs: 15 * 60e3 },
};

/** Exits with code 1 when a PIN or the secret is a placeholder or weak (unless ALLOW_DEFAULTS=1). */
config.verify = () => {
  const bad = [];
  if (PLACEHOLDERS.includes(config.parentPin)) bad.push('PARENT_PIN is a placeholder');
  if (PLACEHOLDERS.includes(config.childPin)) bad.push('CHILD_PIN is a placeholder');
  if (config.parentPin === config.childPin) bad.push('PARENT_PIN and CHILD_PIN are the same');
  if (PLACEHOLDERS.includes(config.secret) || config.secret.length < 16) {
    bad.push('SECRET is a placeholder or shorter than 16 characters');
  }
  if (bad.length && !config.allowDefaults) {
    console.error(messages.refusingToStart(bad));
    process.exit(1);
  }
};

module.exports = config;
