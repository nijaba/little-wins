// Languages: the family's language, the starter list in it, error codes, translation files.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { startServer, jar, ROOT } = require('./helpers');
const i18n = require('../server/i18n');

const { LANGUAGES, STARTER_POINTS } = i18n;
const OTHERS = LANGUAGES.filter((l) => l !== 'en');

let srv;
before(async () => {
  srv = await startServer({ allowlist: '*', signup: 'open' });
});
after(() => srv.close());

// Sign-ins are limited to 10 a minute per process: restart (a fresh limiter) before running out.
const family = async (opts) => {
  if (srv.logins >= 9) await srv.restart();
  return srv.newFamily(opts);
};
const state = async (f) => (await srv.api(f.jar, '/api/state')).json;
const saveBody = (extra) => ({ name: 'Renamed', timezone: 'UTC', week_start: 1, ...extra });

/** Loads public/strings.<lang>.js the way the page does, with a fake window. */
function loadStrings(lang) {
  const sandbox = { window: {} };
  vm.runInNewContext(
    fs.readFileSync(path.join(ROOT, 'public', `strings.${lang}.js`), 'utf8'),
    sandbox,
  );
  return sandbox.window.LW_STRINGS[lang];
}

test('LG-01 the language chosen at setup is stored and returned in the state', async () => {
  for (const language of LANGUAGES) {
    const f = await family({ language });
    assert.equal(f.state.family.language, language, 'setup answer');
    assert.equal((await state(f)).family.language, language, 'state');
  }
});

test('LG-02 an unknown language is refused at setup, and the account can still set up', async () => {
  if (srv.logins >= 9) await srv.restart();
  const j = jar();
  const r = await srv.signIn(j, 'google', { sub: 'lg-02', email: 'lg02@example.test', name: 'Lg' });
  assert.ok(r.ok, r.body);
  const ok = { family_name: 'F', child_name: 'C', timezone: 'UTC' };
  for (const language of ['xx', 'EN', 'zh-CN', '', 5]) {
    const res = await srv.api(j, '/api/setup', { ...ok, language });
    assert.equal(res.status, 400, JSON.stringify(language));
    assert.equal(res.json.code, 'invalidLanguage');
  }
  assert.equal((await srv.api(j, '/api/state')).json.setup, true, 'still not set up');
  assert.equal((await srv.api(j, '/api/setup', { ...ok, language: 'de' })).status, 200);
});

test('LG-03 setup without a language follows Accept-Language, else English', async () => {
  for (const [header, want] of [
    ['fr-CA,fr;q=0.9,en;q=0.5', 'fr'],
    ['de-DE,de;q=0.9', 'de'],
    ['ja,ko;q=0.8', 'en'],
    ['ja,es;q=0.8', 'es'],
    ['zh-CN,zh;q=0.9', 'zh'],
    [undefined, 'en'],
  ]) {
    const f = await family({ headers: header ? { 'Accept-Language': header } : {} });
    assert.equal(f.state.family.language, want, String(header));
    assert.deepEqual(
      (await state(f)).rewards.map((r) => r.name),
      i18n.starter(want).rewards,
      `${header}: starter list`,
    );
  }
  // An explicit language beats the header.
  const f = await family({ language: 'es', headers: { 'Accept-Language': 'de' } });
  assert.equal(f.state.family.language, 'es');
});

test('LG-04 family/save changes the language, keeps it when absent, refuses an unknown one', async () => {
  const f = await family({ language: 'fr' });
  const post = (b) => srv.api(f.jar, '/api/family/save', b);
  let r = await post(saveBody({}));
  assert.equal(r.status, 200);
  assert.equal(r.json.family.language, 'fr', 'kept when absent');
  r = await post(saveBody({ language: 'zh' }));
  assert.equal(r.status, 200);
  assert.equal(r.json.family.language, 'zh');
  assert.equal((await state(f)).family.language, 'zh');
  for (const language of ['xx', 'ZH', 7, '']) {
    r = await post(saveBody({ language }));
    assert.equal(r.status, 400, JSON.stringify(language));
    assert.equal(r.json.code, 'invalidLanguage');
  }
  assert.equal((await state(f)).family.language, 'zh', 'unchanged after refusals');
});

test('LG-05 changing the language later does not rewrite existing names', async () => {
  const f = await family({ language: 'en' });
  const before = (await state(f)).rewards.map((r) => r.name);
  await srv.api(f.jar, '/api/family/save', saveBody({ language: 'de' }));
  assert.deepEqual(
    (await state(f)).rewards.map((r) => r.name),
    before,
  );
});

test('LG-06 the starter list is seeded in the family language with the same points', async () => {
  for (const language of LANGUAGES) {
    const f = await family({ language });
    const S = await state(f);
    const want = i18n.starter(language);
    const items = (kind) => S.items.filter((i) => i.kind === kind);
    assert.deepEqual(
      items('target').map((i) => [i.name, i.note]),
      want.targets,
      `${language} targets`,
    );
    assert.deepEqual(
      items('target').map((i) => [i.pmin, i.pmax]),
      STARTER_POINTS.targets,
      `${language} target points`,
    );
    assert.deepEqual(
      items('penalty').map((i) => [i.name, i.note]),
      want.penalties,
      `${language} penalties`,
    );
    for (const p of items('penalty'))
      assert.deepEqual([p.pmin, p.pmax], [STARTER_POINTS.penalty, STARTER_POINTS.penalty]);
    assert.deepEqual(
      items('challenge').map((i) => i.name),
      want.challenges,
      `${language} challenges`,
    );
    assert.deepEqual(
      S.rewards.map((r) => r.name),
      want.rewards,
      `${language} rewards`,
    );
    assert.deepEqual(
      S.rewards.map((r) => [r.stars, r.points]),
      STARTER_POINTS.rewards,
      `${language} reward points`,
    );
  }
});

test('LG-07 every starter translation has the English lengths, with no empty names', () => {
  const en = i18n.starter('en');
  for (const lang of OTHERS) {
    const t = require(`../server/i18n/${lang}`).starter;
    assert.equal(i18n.starter(lang), t, `${lang} is used, not the English fallback`);
    assert.equal(t.targets.length, en.targets.length, `${lang} targets`);
    assert.equal(t.penalties.length, en.penalties.length, `${lang} penalties`);
    assert.equal(t.challenges.length, en.challenges.length, `${lang} challenges`);
    assert.equal(t.rewards.length, en.rewards.length, `${lang} rewards`);
    for (const [name] of [...t.targets, ...t.penalties]) assert.ok(name?.trim(), lang);
    for (const name of [...t.challenges, ...t.rewards]) assert.ok(name?.trim(), lang);
    // A note is empty exactly where the English one is.
    for (const [i, [, note]] of t.targets.entries())
      assert.equal(note === '', en.targets[i][1] === '', `${lang} target note ${i}`);
  }
  assert.equal(STARTER_POINTS.targets.length, en.targets.length);
  assert.equal(STARTER_POINTS.rewards.length, en.rewards.length);
});

test('LG-08 fromAcceptLanguage picks by quality, ignores regions and unknown tags', () => {
  const f = i18n.fromAcceptLanguage;
  assert.equal(f('de'), 'de');
  assert.equal(f('de-AT,de;q=0.8,en;q=0.5'), 'de');
  assert.equal(f('en;q=0.4, fr;q=0.9'), 'fr');
  assert.equal(f('fr;q=0.5, es;q=0.7, en;q=0.1'), 'es');
  assert.equal(f('ja, es;q=0.5'), 'es', 'skips unsupported tags');
  assert.equal(f('es;q=0, fr;q=0.1'), 'fr', 'q=0 means not acceptable');
  assert.equal(f('zh-CN'), 'zh');
  assert.equal(f('zh-TW'), 'zh');
  assert.equal(f('ZH-hans-CN'), 'zh', 'case-insensitive');
  assert.equal(f(''), 'en');
  assert.equal(f(undefined), 'en');
  assert.equal(f('*'), 'en');
  assert.equal(f('ja,ko'), 'en');
  assert.equal(f(',,;;q=,'), 'en', 'junk does not throw');
  assert.deepEqual(LANGUAGES, ['en', 'zh', 'es', 'fr', 'de']);
  assert.ok(i18n.isLanguage('fr') && !i18n.isLanguage('zh-CN') && !i18n.isLanguage('xx'));
});

test('LG-09 API errors carry the English text and a stable code', async () => {
  const f = await family({});
  let r = await srv.api(f.jar, '/api/item/delete', { id: 999999 });
  assert.equal(r.status, 404);
  assert.equal(r.json.code, 'notFound');
  assert.equal(r.json.error, 'not found');
  r = await srv.api(f.jar, '/api/child/save', { name: '  ' });
  assert.equal(r.status, 400);
  assert.equal(r.json.code, 'nameRequired');
  assert.match(r.json.error, /name is required/i);
  r = await srv.api(null, '/api/state');
  assert.equal(r.status, 401);
  assert.equal(r.json.code, 'login');
  r = await srv.api(f.jar, '/api/family/save', '{}', { contentType: 'text/plain' });
  assert.equal(r.status, 415);
  assert.equal(r.json.code, 'jsonOnly');
  assert.ok(r.json.error);
  r = await srv.api(f.jar, '/api/family/save', saveBody({}), {
    headers: { Origin: 'https://evil.example' },
  });
  assert.equal(r.status, 403);
  assert.equal(r.json.code, 'foreignOrigin');
  r = await srv.api(f.jar, '/api/family/save', saveBody({ language: 'xx' }));
  assert.equal(r.json.code, 'invalidLanguage');
  assert.equal(r.json.error, 'Unknown language');
});

test('LG-10 limitReached carries the limit and tooManyTries the seconds', async () => {
  const limited = await startServer({ signup: 'open', env: { LIMIT_CHILDREN: '1' } });
  try {
    const f = await limited.newFamily({});
    const r = await limited.api(f.jar, '/api/child/save', { name: 'Second' });
    assert.equal(r.status, 409);
    assert.equal(r.json.code, 'limitReached');
    assert.equal(r.json.limit, 'children');
    assert.match(r.json.error, /limit for children/);
    for (let i = 0; i < 10; i++) await limited.api(null, '/api/pair', { code: 'ABCD-EFGH-JK' });
    const t = await limited.api(null, '/api/pair', { code: 'ABCD-EFGH-JK' });
    assert.equal(t.status, 429);
    assert.equal(t.json.code, 'tooManyTries');
    assert.equal(typeof t.json.seconds, 'number');
    assert.ok(t.json.seconds > 0);
    assert.match(t.json.error, /Try again in \d+s/);
  } finally {
    await limited.close();
  }
});

test('LG-11 every code the server can send has an English page string', () => {
  const en = loadStrings('en').errors;
  const codes = new Set();
  for (const f of fs.readdirSync(path.join(ROOT, 'server'))) {
    if (!f.endsWith('.js')) continue;
    const src = fs.readFileSync(path.join(ROOT, 'server', f), 'utf8');
    for (const m of src.matchAll(/apiError\(\s*'(\w+)'/g)) codes.add(m[1]);
    for (const m of src.matchAll(/\[\d{3}, '(\w+)'\]/g)) codes.add(m[1]); // checkWrite refusals
  }
  for (const c of ['jsonOnly', 'foreignOrigin', 'tooManyTries', 'limitReached'])
    assert.ok(codes.has(c), `${c} is found in the server code`);
  assert.ok(codes.size > 15, `only found ${codes.size} codes`);
  const messages = require('../server/messages');
  for (const c of codes) {
    assert.ok(Object.hasOwn(messages, c), `${c} is in server/messages.js`);
    assert.ok(en[c], `${c} is in strings.en.js errors`);
  }
});

/** Every key path of an object, with the type of its leaf ("function", "string", ...). */
function shape(o, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(o)) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (Array.isArray(v)) {
      out[p] = `array(${v.length})`;
      v.forEach((x, i) => {
        if (x && typeof x === 'object') shape(x, `${p}[${i}]`, out);
      });
    } else if (v && typeof v === 'object') shape(v, p, out);
    else out[p] = typeof v;
  }
  return out;
}

test('LG-12 every page translation has exactly the English keys, functions staying functions', () => {
  const en = shape(loadStrings('en'));
  assert.ok(Object.keys(en).length > 200);
  for (const lang of OTHERS) {
    const t = shape(loadStrings(lang));
    const missing = Object.keys(en).filter((k) => !(k in t));
    const extra = Object.keys(t).filter((k) => !(k in en));
    const kind = Object.keys(en).filter((k) => k in t && t[k] !== en[k]);
    assert.deepEqual(missing, [], `${lang}: missing keys`);
    assert.deepEqual(extra, [], `${lang}: extra keys`);
    assert.deepEqual(
      kind.map((k) => `${k}: ${en[k]} vs ${t[k]}`),
      [],
      `${lang}: different kind`,
    );
  }
});

test('LG-13 server page translations have the English keys, and every page file a locale', () => {
  const en = shape(require('../server/i18n/en').pages);
  for (const lang of OTHERS) {
    const t = shape(require(`../server/i18n/${lang}`).pages);
    assert.deepEqual(t, en, `${lang} pages`);
    assert.ok(loadStrings(lang).locale, `${lang} has a locale`);
  }
  assert.equal(loadStrings('zh').locale, 'zh-CN');
});

test('LG-14 the sign-in problem pages follow Accept-Language', async () => {
  const get = (al) =>
    fetch(`${srv.base}/auth/google/callback`, {
      headers: al ? { 'Accept-Language': al } : {},
    }).then(async (r) => ({ status: r.status, text: await r.text() }));
  for (const [al, lang] of [
    ['de-DE,de;q=0.9', 'de'],
    ['zh-CN,zh;q=0.9', 'zh'],
    ['fr', 'fr'],
    ['es-MX', 'es'],
    ['ja', 'en'],
    [undefined, 'en'],
  ]) {
    const r = await get(al);
    const pages = i18n.pages(lang);
    assert.equal(r.status, 400);
    assert.match(r.text, new RegExp(`<html lang=${lang}>`), String(al));
    assert.ok(r.text.includes(pages.signInExpired), `${al}: message in ${lang}`);
    assert.ok(r.text.includes(pages.backToApp), `${al}: back link in ${lang}`);
  }
  assert.notEqual(i18n.pages('de').signInExpired, i18n.pages('en').signInExpired);
  assert.notEqual(i18n.pages('zh').signInExpired, i18n.pages('en').signInExpired);
});

test('LG-15 every server text in every language is filled in, and its functions give text', () => {
  for (const lang of LANGUAGES) {
    const bundle = require(`../server/i18n/${lang}`);
    const walk = (o, at) => {
      for (const [k, v] of Object.entries(o)) {
        const where = `${lang}: ${at}${k}`;
        if (typeof v === 'function') {
          const out = v('Lego', 3);
          assert.ok(typeof out === 'string' && out.length > 0, where);
          assert.ok(out.includes('Lego') || out.includes('3'), `${where} uses its argument`);
        } else if (typeof v === 'string') assert.ok(v.length > 0, where);
        else if (v && typeof v === 'object') walk(v, `${at}${k}.`);
      }
    };
    walk(
      { pages: bundle.pages, notice: bundle.notice, reminder: bundle.reminder, demo: bundle.demo },
      '',
    );
    assert.equal(typeof i18n.notice(lang).reward, 'function', `${lang}: notice texts`);
  }
});
