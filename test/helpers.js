// Shared test helpers: start server/index.js on a free port with a temporary database, sign in
// through the fake provider (the real OAuth code path), and call the API with a cookie jar.
// Never touches data/. Every server is stopped and its temp folder removed by srv.close().
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const ROOT = path.join(__dirname, '..');
// Generated per run, so no secret-looking literal sits in the repository.
const SECRET = crypto.randomBytes(32).toString('hex');

const live = new Set(); // child processes still running
const dirs = new Set(); // temp folders still to remove
process.on('exit', () => {
  for (const c of live) c.kill('SIGKILL');
  for (const d of dirs) fs.rmSync(d, { recursive: true, force: true });
});

/** Lets c8 measure server processes: the children get their own coverage folder variable. */
const coverageEnv = () =>
  process.env.NODE_V8_COVERAGE ? { NODE_V8_COVERAGE: process.env.NODE_V8_COVERAGE } : {};

const freePort = () =>
  new Promise((resolve) => {
    const s = net.createServer().listen(0, () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });

function tmpDir(label = 'srv') {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), `little-wins-${label}-`));
  dirs.add(d);
  return d;
}
function removeDir(d) {
  fs.rmSync(d, { recursive: true, force: true });
  dirs.delete(d);
}

/** Runs server/index.js with exactly this environment. Resolves at "up"; rejects if it exits. */
function launch(env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['server/index.js'], {
      cwd: ROOT,
      env: { PATH: process.env.PATH, ...coverageEnv(), ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    live.add(child);
    let stdout = '';
    let out = '';
    child.stdout.on('data', (d) => {
      stdout += d;
      out += d;
      if (/(^|\n)up\n/.test(stdout)) resolve({ child, output: () => out });
    });
    child.stderr.on('data', (d) => {
      out += d;
    });
    child.on('exit', (code) => {
      live.delete(child);
      reject(Object.assign(new Error(`server exited (${code}): ${out}`), { code, out }));
    });
  });
}

const stopChild = (child) =>
  new Promise((resolve) => {
    if (!child || child.exitCode !== null || child.signalCode) return resolve();
    const timer = setTimeout(() => child.kill('SIGKILL'), 7000);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
    child.kill('SIGTERM');
  });

// --- Cookie jar and HTTP -------------------------------------------------------------------
const jar = () => ({
  c: {},
  get header() {
    return Object.entries(this.c)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  },
});

function keep(j, res) {
  if (!j) return;
  for (const sc of res.headers.getSetCookie()) {
    const [kv] = sc.split(';');
    const i = kv.indexOf('=');
    const k = kv.slice(0, i);
    const v = kv.slice(i + 1);
    if (v) j.c[k] = v;
    else delete j.c[k];
  }
}

const SESSION = 'lw_session';

/** Parent or child sign-in names for the fake provider (see server/fake-sso.js). */
async function signIn(srv, j, provider, who, { invite } = {}) {
  srv.logins++;
  const q = invite ? `?invite=${encodeURIComponent(invite)}` : '';
  let res = await fetch(`${srv.base}/auth/${provider}/login${q}`, {
    redirect: 'manual',
    headers: { cookie: j.header },
  });
  keep(j, res);
  if (res.status !== 303) throw new Error(`sign-in start answered ${res.status}`);
  const loc = new URL(res.headers.get('location'));
  const extra = typeof who === 'string' ? { as: who } : who;
  for (const [k, v] of Object.entries(extra)) loc.searchParams.set(k, v);
  res = await fetch(loc, { redirect: 'manual' });
  const back = res.headers.get('location');
  if (!back) throw new Error(`fake provider answered ${res.status} without a redirect`);
  res = await fetch(back, { redirect: 'manual', headers: { cookie: j.header } });
  keep(j, res);
  const location = res.headers.get('location');
  return {
    status: res.status,
    location,
    ok: res.status === 303 && location === '/' && !!j.c[SESSION],
    body: res.status === 303 ? '' : await res.text(),
    headers: res.headers,
  };
}

/** GET (no body) or JSON POST. opts: { headers, method, contentType ('' = none) }. */
async function api(srv, j, p, body, opts = {}) {
  const headers = { ...(j ? { cookie: j.header } : {}), ...opts.headers };
  const init = { headers };
  if (body !== undefined || opts.method) {
    init.method = opts.method || 'POST';
    if (body !== undefined) init.body = typeof body === 'string' ? body : JSON.stringify(body);
    const type = opts.contentType ?? 'application/json';
    if (type) headers['Content-Type'] = type;
  }
  const res = await fetch(srv.base + p, init);
  keep(j, res);
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: res.status, json, text, headers: res.headers };
}

/** A raw GET that keeps the path as written (fetch would normalize "/../x"). */
const rawStatus = (srv, p) =>
  new Promise((resolve, reject) => {
    http
      .get(`${srv.base}/`, { path: p }, (r) => {
        r.resume();
        resolve(r.statusCode);
      })
      .on('error', reject);
  });

/**
 * A raw request to 127.0.0.1 (so the peer address is known), without following redirects and
 * with any headers, including a hostile Host. Resolves to { status, headers, text }.
 */
const raw = (srv, p, { method = 'GET', headers = {}, body } = {}) =>
  new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port: srv.port, path: p, method, headers },
      (r) => {
        let text = '';
        r.on('data', (c) => {
          text += c;
        });
        r.on('end', () =>
          resolve({
            status: r.statusCode,
            headers: new Headers(Object.entries(r.headers).map(([k, v]) => [k, String(v)])),
            text,
          }),
        );
      },
    );
    req.on('error', reject);
    req.end(body);
  });

/** A configuration like a real deployment: https APP_BASE_URL, a real provider, no fake sign-in. */
const hostedEnv = (extra = {}) => ({
  APP_BASE_URL: 'https://little.example.test',
  LITTLE_WINS_FAKE_SSO: undefined,
  GOOGLE_CLIENT_ID: 'id',
  GOOGLE_CLIENT_SECRET: 'secret',
  ...extra,
});

// --- Servers -----------------------------------------------------------------------------------
let counter = 0;

/**
 * Starts a server. Options: allowlist (PARENT_ALLOWLIST), signup (SIGNUP_MODE), env (extra or
 * overriding variables, undefined removes one), dir (a temp folder, maybe with a database).
 * The sign-in rate limit is 10 per minute per process, so keep srv.logins under 10.
 */
async function startServer({ allowlist = '', signup, env = {}, dir } = {}) {
  const owned = dir ?? tmpDir('srv');
  const port = await freePort();
  const srv = {
    port,
    base: `http://localhost:${port}`,
    dir: owned,
    dbPath: path.join(owned, 'test.db'),
    logins: 0,
  };
  const vars = {
    PORT: String(port),
    DATABASE_PATH: srv.dbPath,
    APP_BASE_URL: srv.base,
    SESSION_SECRET: SECRET,
    LITTLE_WINS_FAKE_SSO: '1',
    PARENT_ALLOWLIST: allowlist,
    ...(signup ? { SIGNUP_MODE: signup } : {}),
    ...(process.env.TZ ? { TZ: process.env.TZ } : {}),
    ...env,
  };
  for (const k of Object.keys(vars)) if (vars[k] === undefined) delete vars[k];
  const run = await launch(vars);
  srv.child = run.child;
  srv.output = run.output;
  srv.signIn = (j, provider, who, o) => signIn(srv, j, provider, who, o);
  srv.api = (j, p, body, o) => api(srv, j, p, body, o);
  srv.newFamily = (o) => newFamily(srv, o);
  srv.pairChild = (j, childId, o) => pairChild(srv, j, childId, o);
  /** Runs fn(db) on the server's database (WAL mode lets this run beside the server). */
  srv.sql = (fn) => {
    const db = new DatabaseSync(srv.dbPath);
    db.exec('PRAGMA busy_timeout = 5000');
    try {
      return fn(db);
    } finally {
      db.close();
    }
  };
  srv.restart = async () => {
    await stopChild(srv.child);
    const again = await launch(vars);
    srv.child = again.child;
    srv.output = again.output;
    srv.logins = 0;
  };
  srv.close = async () => {
    await stopChild(srv.child);
    removeDir(owned);
  };
  return srv;
}

/** Starts a server that must refuse to start; resolves to { code, out }. */
async function startFails(env) {
  try {
    const run = await launch({ ...env });
    await stopChild(run.child);
  } catch (err) {
    if (typeof err.code === 'number') return { code: err.code, out: err.out };
    throw err;
  }
  throw new Error(`server started with ${JSON.stringify(env)}`);
}

/** A signed-in parent with a new family (through the real setup call). */
async function newFamily(
  srv,
  {
    name = 'Test Family',
    child = 'Kid',
    tz = 'UTC',
    weekStart,
    starter = true,
    who,
    provider,
  } = {},
) {
  const n = ++counter;
  const prov = provider ?? 'google';
  const identity =
    who ??
    (prov === 'google'
      ? { sub: `sub-${process.pid}-${n}`, email: `parent${n}@example.test`, name: `Parent ${n}` }
      : { sub: String(5000 + n), login: `gh-parent-${n}`, name: `Parent ${n}` });
  const j = jar();
  const r = await signIn(srv, j, prov, identity);
  if (!r.ok) throw new Error(`sign-in failed: ${r.status} ${r.body}`);
  const setup = await api(srv, j, '/api/setup', {
    family_name: name,
    child_name: child,
    timezone: tz,
    week_start: weekStart,
    starter,
  });
  if (setup.status !== 200) throw new Error(`setup failed: ${setup.status} ${setup.text}`);
  return { jar: j, state: setup.json, childId: setup.json.childId, who: identity };
}

/** Pairs a new device (its own jar) to a child with a one-time code from a parent session. */
async function pairChild(srv, parentJar, childId, { headers } = {}) {
  const made = await api(srv, parentJar, '/api/pairing/create', { child_id: childId });
  if (made.status !== 200) throw new Error(`pairing/create answered ${made.status}`);
  const j = jar();
  const r = await api(srv, j, '/api/pair', { code: made.json.issued.code }, { headers });
  if (r.status !== 200) throw new Error(`pair answered ${r.status}`);
  return { jar: j, code: made.json.issued.code, issued: made.json.issued };
}

// --- Misc ------------------------------------------------------------------------------------------
/** A signed sign-in state cookie value like the one server/auth.js makes (to craft old ones). */
function craftState(payload, t = Date.now(), secret = SECRET) {
  const body = Buffer.from(JSON.stringify({ ...payload, t })).toString('base64url');
  const mac = crypto.createHmac('sha256', secret).update(body).digest().toString('base64url');
  return `${body}.${mac}`;
}

/** Every key of parentRoutes in server/routes.js, so a new route can't dodge the suite. */
function parentRouteList() {
  const src = fs.readFileSync(path.join(ROOT, 'server', 'routes.js'), 'utf8');
  const start = src.indexOf('const parentRoutes = {');
  const end = src.indexOf('\n  };', start);
  assertFound(start >= 0 && end > start, 'could not find parentRoutes in server/routes.js');
  const routes = [...src.slice(start, end).matchAll(/^ {4}'(\/api\/[\w/]+)'/gm)].map((m) => m[1]);
  assertFound(routes.length > 10, `only found ${routes.length} routes in parentRoutes`);
  return routes;
}
function assertFound(ok, message) {
  if (!ok) throw new Error(message);
}

const item = (S, kind, name) =>
  S.items.find((i) => i.kind === kind && (!name || i.name.startsWith(name)));

module.exports = {
  ROOT,
  SECRET,
  coverageEnv,
  SESSION,
  jar,
  signIn,
  api,
  rawStatus,
  raw,
  hostedEnv,
  startServer,
  startFails,
  newFamily,
  pairChild,
  craftState,
  parentRouteList,
  item,
  tmpDir,
  removeDir,
};
