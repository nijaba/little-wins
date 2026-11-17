/**
 * Parent sign-in with Google or GitHub: the OAuth 2.0 authorization-code flow with PKCE.
 * The state, code verifier and any invite travel in a signed cookie that lasts 10 minutes,
 * so the server keeps no sign-in state. Accounts are matched on (provider, stable subject).
 */
const crypto = require('node:crypto');
const config = require('./config');
const i18n = require('./i18n');
const { allows } = require('./allowlist');
const { readCookie } = require('./sessions');

const b64url = (buf) => Buffer.from(buf).toString('base64url');
const hmac = (text) => crypto.createHmac('sha256', config.sessionSecret).update(text).digest();

/** Signs a small JSON payload: base64url(json).base64url(hmac). */
function sign(payload) {
  const body = b64url(JSON.stringify({ ...payload, t: Date.now() }));
  return `${body}.${b64url(hmac(body))}`;
}

/** Verifies a signed payload no older than maxAgeMs; returns it or null. */
function verify(value, maxAgeMs) {
  if (typeof value !== 'string' || !value.includes('.')) return null;
  const [body, mac] = value.split('.');
  // Compare the encoded strings, so only the one canonical spelling of the MAC is accepted.
  const expected = Buffer.from(b64url(hmac(body)));
  const given = Buffer.from(mac || '');
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (typeof payload.t !== 'number' || Date.now() - payload.t > maxAgeMs) return null;
    return payload;
  } catch {
    return null;
  }
}

const stateCookie = (value, maxAge) =>
  `${config.cookies.state}=${value}; ${config.cookies.attrs}; Max-Age=${maxAge}`;

const escapeHtml = (text) =>
  String(text).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

/**
 * A plain page for sign-in problems (no inline script or style, so the CSP holds), in the
 * browser's language: no family is known yet. `key` names the text in server/i18n; a
 * function there gets `arg`.
 */
function failPage(req, res, key, status = 400, arg) {
  const lang = i18n.fromAcceptLanguage(req.headers['accept-language']);
  const text = i18n.pages(lang);
  const message = typeof text[key] === 'function' ? text[key](arg) : text[key];
  res.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Set-Cookie': stateCookie('', 0),
    'Content-Security-Policy': "default-src 'self'; frame-ancestors 'none'; base-uri 'none'",
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(
    `<!doctype html><html lang=${lang}><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>${escapeHtml(text.appName)}</title><link rel=stylesheet href=/style.css><main class=center><h2>${escapeHtml(text.appName)}</h2><p>${escapeHtml(message)}</p><p><a href=/>${escapeHtml(text.backToApp)}</a></p></main>`,
  );
}

const redirect = (res, location, cookies = []) => {
  res.writeHead(303, { Location: location, 'Set-Cookie': cookies, 'Cache-Control': 'no-store' });
  res.end();
};

async function fetchJson(url, options) {
  const res = await fetch(url, { ...options, signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  return res.json();
}

/** Exchanges the code for an access token and reads who signed in. */
async function fetchIdentity(provider, code, verifier) {
  const token = await fetchJson(provider.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${config.baseUrl}/auth/${provider.name}/callback`,
      client_id: provider.clientId,
      client_secret: provider.clientSecret,
      code_verifier: verifier,
    }),
  });
  if (!token.access_token) throw new Error('no access token');
  const headers = {
    Authorization: `Bearer ${token.access_token}`,
    Accept: provider.name === 'github' ? 'application/vnd.github+json' : 'application/json',
    'User-Agent': 'little-wins',
  };
  const info = await fetchJson(provider.userinfoUrl, { headers });

  if (provider.name === 'google') {
    if (!info.sub || !info.email || info.email_verified !== true) {
      throw new SignInError('emailNotVerified'); // a key in server/i18n
    }
    return {
      provider: 'google',
      subject: String(info.sub),
      email: String(info.email).toLowerCase(),
      domain: info.hd ? String(info.hd).toLowerCase() : null,
      name: String(info.name || info.email).slice(0, 80),
    };
  }
  if (!info.id || !info.login) throw new Error('GitHub did not return an id and login');
  return {
    provider: 'github',
    subject: String(info.id),
    login: String(info.login),
    name: String(info.name || info.login).slice(0, 80),
  };
}

class SignInError extends Error {}

function createAuth({ repo, sessions, limiter, clientIp }) {
  /** GET /auth/<provider>/login[?invite=…]: off to the provider. */
  function login(req, res, providerName, query) {
    const provider = config.providers[providerName];
    if (!provider) return failPage(req, res, 'unknownProvider', 404);
    const wait = limiter.hit(`auth:${clientIp(req)}`);
    if (wait) return failPage(req, res, 'tooManyTries', 429, wait);

    const verifier = b64url(crypto.randomBytes(32));
    const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
    const state = b64url(crypto.randomBytes(16));
    const invite = query.get('invite');
    const params = new URLSearchParams({
      client_id: provider.clientId,
      redirect_uri: `${config.baseUrl}/auth/${provider.name}/callback`,
      response_type: 'code',
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    });
    if (provider.scope) params.set('scope', provider.scope);
    if (provider.name === 'google') params.set('prompt', 'select_account');
    const cookie = sign({ p: provider.name, s: state, v: verifier, i: invite || null });
    redirect(res, `${provider.authorizeUrl}?${params}`, [
      stateCookie(cookie, config.cookies.stateMaxAge),
    ]);
  }

  /** GET /auth/<provider>/callback: checks the state, signs the parent in, decides where to go. */
  async function callback(req, res, providerName, query) {
    const provider = config.providers[providerName];
    if (!provider) return failPage(req, res, 'unknownProvider', 404);
    const saved = verify(readCookie(req, config.cookies.state), config.cookies.stateMaxAge * 1000);
    if (!saved) return failPage(req, res, 'signInExpired');
    if (saved.p !== provider.name || !query.get('state') || query.get('state') !== saved.s) {
      return failPage(req, res, 'signInUnchecked');
    }
    if (query.get('error') || !query.get('code')) return redirect(res, '/', [stateCookie('', 0)]);
    // A checked callback calls the provider, so it is limited like the start of a sign-in.
    const wait = limiter.hit(`callback:${clientIp(req)}`);
    if (wait) return failPage(req, res, 'tooManyTries', 429, wait);

    let identity;
    try {
      identity = await fetchIdentity(provider, query.get('code'), saved.v);
    } catch (err) {
      if (err instanceof SignInError) return failPage(req, res, err.message);
      console.warn(`${provider.name} sign-in failed: ${err.message}`);
      return failPage(req, res, 'providerFailed', 502);
    }

    const owner = decide(identity, saved.i);
    if (!owner) return failPage(req, res, 'privateInstance', 403);
    const { cookie } = sessions.create({ kind: 'parent', ...owner }, req);
    redirect(res, '/', [stateCookie('', 0), cookie]);
  }

  /**
   * Which family a signed-in parent lands in: { userId, familyId|null } (null = set one up),
   * or null when they may not use this installation.
   */
  function decide(identity, inviteToken) {
    const user = repo.upsertUser(identity);
    const membership = repo.membershipOf(user.id);
    if (membership) return { userId: user.id, familyId: membership.family_id };

    const invite = inviteToken ? repo.findInvite(inviteToken) : null;
    if (
      invite &&
      repo.count(invite.family_id, 'parents') < config.limits.parents &&
      repo.useInvite(invite.id)
    ) {
      repo.addMember(invite.family_id, user.id, 'parent');
      repo.bump(invite.family_id);
      return { userId: user.id, familyId: invite.family_id };
    }

    const allowlisted = allows(config.allowlist, identity);
    if (!allowlisted && config.signupMode !== 'open') {
      // An operator may sign in to see the operator page without a family.
      return allows(config.operatorAllowlist, identity)
        ? { userId: user.id, familyId: null }
        : null;
    }
    // Only an allowlisted parent may claim a family without parents (migrated data):
    // with open sign-up, a stranger must never land in someone else's family.
    const unclaimed = allowlisted ? repo.unclaimedFamily() : null;
    if (unclaimed) {
      repo.addMember(unclaimed, user.id, 'owner');
      repo.bump(unclaimed);
      return { userId: user.id, familyId: unclaimed };
    }
    return { userId: user.id, familyId: null };
  }

  return { login, callback };
}

module.exports = { createAuth, sign, verify };
