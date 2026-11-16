/**
 * A fake Google and GitHub for local development and tests. Mounted only when
 * LITTLE_WINS_FAKE_SSO=1 and APP_BASE_URL is localhost (config.js refuses it elsewhere).
 * It speaks enough OAuth (with PKCE) for server/auth.js to run its real code path.
 *
 *   /_fake-sso/<provider>/authorize   pick an identity (a page of links), or pass one directly:
 *                                     ?as=alice | ?sub=…&email=…&verified=0&login=…&name=…&hd=…
 *   /_fake-sso/<provider>/token       code + verifier → access token
 *   /_fake-sso/<provider>/userinfo    the identity, shaped like the real provider's answer
 */
const crypto = require('node:crypto');

const PEOPLE = {
  alice: { sub: 'g-alice', email: 'alice@example.com', name: 'Alice Example' },
  bob: { sub: 'g-bob', email: 'bob@example.com', name: 'Bob Example' },
  carol: { sub: '1003', login: 'carol-dev', name: 'Carol Example' },
  dan: { sub: '1004', login: 'dan-dev', name: 'Dan Example' },
};

const codes = new Map(); // code → { person, challenge, redirect, provider }
const tokens = new Map(); // access token → person

const sha256 = (text) => crypto.createHash('sha256').update(text).digest('base64url');
const esc = (t) =>
  String(t).replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c],
  );

function readForm(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (c) => {
      body += c;
    });
    req.on('end', () => resolve(new URLSearchParams(body)));
  });
}

async function handleFakeSso(req, res, url) {
  const [, , provider, step] = url.pathname.split('/');
  if (!['google', 'github'].includes(provider)) {
    res.writeHead(404);
    return res.end();
  }
  const q = url.searchParams;

  if (step === 'authorize') {
    const person =
      PEOPLE[q.get('as')] ||
      (q.get('sub')
        ? {
            sub: q.get('sub'),
            email: q.get('email'),
            login: q.get('login'),
            name: q.get('name') || q.get('sub'),
            hd: q.get('hd'),
            unverified: q.get('verified') === '0',
          }
        : null);
    if (!person) {
      // A page of links, one per test person (no script, so the CSP holds).
      const links = Object.keys(PEOPLE)
        .map((key) => {
          const next = new URLSearchParams(q);
          next.set('as', key);
          return `<li><a href="?${esc(next)}">${esc(PEOPLE[key].name)} (${esc(PEOPLE[key].email || PEOPLE[key].login)})</a></li>`;
        })
        .join('');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(
        `<!doctype html><meta charset=utf-8><title>Fake ${esc(provider)} sign-in</title><h1>Fake ${esc(provider)} sign-in</h1><p>Development only.</p><ul>${links}</ul>`,
      );
    }
    const code = crypto.randomBytes(16).toString('hex');
    codes.set(code, {
      person,
      provider,
      challenge: q.get('code_challenge'),
      redirect: q.get('redirect_uri'),
    });
    const back = new URL(q.get('redirect_uri'));
    back.searchParams.set('code', code);
    back.searchParams.set('state', q.get('state') || '');
    res.writeHead(303, { Location: back.toString() });
    return res.end();
  }

  if (step === 'token' && req.method === 'POST') {
    const form = await readForm(req);
    const entry = codes.get(form.get('code'));
    codes.delete(form.get('code'));
    const ok =
      entry &&
      entry.provider === provider &&
      form.get('client_secret') === 'fake-secret' &&
      form.get('redirect_uri') === entry.redirect &&
      sha256(form.get('code_verifier') || '') === entry.challenge;
    if (!ok) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'invalid_grant' }));
    }
    const token = crypto.randomBytes(16).toString('hex');
    tokens.set(token, entry.person);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ access_token: token, token_type: 'bearer' }));
  }

  if (step === 'userinfo') {
    const person = tokens.get((req.headers.authorization || '').replace(/^Bearer /, ''));
    if (!person) {
      res.writeHead(401);
      return res.end();
    }
    const body =
      provider === 'google'
        ? {
            sub: person.sub,
            email: person.email,
            email_verified: !person.unverified,
            name: person.name,
            ...(person.hd ? { hd: person.hd } : {}),
          }
        : {
            id: Number(person.sub) || person.sub,
            login: person.login || person.sub,
            name: person.name,
          };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(body));
  }

  res.writeHead(404);
  res.end();
}

module.exports = { handleFakeSso, PEOPLE };
