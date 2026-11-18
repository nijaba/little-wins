// Emails to the operator (NOTIFY_EMAIL): a family signed up, the limit reached, a parent turned
// away, a family deleted. Counts only. A fake mail server on localhost receives them.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const path = require('node:path');
const { startServer, startFails, jar, tmpDir } = require('./helpers');
const { sendMail } = require('../server/mailer');
const { createAlerts } = require('../server/alerts');

/** A plain SMTP server on 127.0.0.1 that keeps what it receives. reject: AUTH answers 535. */
async function fakeSmtp({ reject = false } = {}) {
  const got = { messages: [], auth: [] };
  const server = net.createServer((sock) => {
    let buf = '';
    let data = false;
    let msg = null;
    sock.write('220 fake ESMTP\r\n');
    sock.on('data', (chunk) => {
      buf += chunk.toString('utf8');
      for (;;) {
        if (data) {
          const end = buf.indexOf('\r\n.\r\n');
          if (end < 0) return;
          msg.data = buf.slice(0, end);
          buf = buf.slice(end + 5);
          data = false;
          got.messages.push(msg);
          sock.write('250 queued\r\n');
          continue;
        }
        const i = buf.indexOf('\r\n');
        if (i < 0) return;
        const line = buf.slice(0, i);
        buf = buf.slice(i + 2);
        if (line.startsWith('EHLO')) sock.write('250-fake\r\n250-8BITMIME\r\n250 AUTH PLAIN\r\n');
        else if (line.startsWith('AUTH PLAIN ')) {
          got.auth.push(Buffer.from(line.slice(11), 'base64').toString('utf8'));
          sock.write(reject ? '535 5.7.8 bad credentials\r\n' : '235 ok\r\n');
        } else if (line.startsWith('MAIL FROM:')) {
          msg = { from: line.slice(10), to: [] };
          sock.write('250 ok\r\n');
        } else if (line.startsWith('RCPT TO:')) {
          msg.to.push(line.slice(8));
          sock.write('250 ok\r\n');
        } else if (line === 'DATA') {
          data = true;
          sock.write('354 go\r\n');
        } else if (line === 'QUIT') sock.end('221 bye\r\n');
        else sock.write('500 what\r\n');
      }
    });
    sock.on('error', () => {});
  });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  got.port = server.address().port;
  got.close = () => new Promise((ok) => server.close(ok));
  /** Waits until `n` messages arrived (or fails after 5 s). */
  got.wait = async (n) => {
    const until = Date.now() + 5000;
    while (got.messages.length < n) {
      if (Date.now() > until) assert.fail(`expected ${n} emails, got ${got.messages.length}`);
      await new Promise((ok) => setTimeout(ok, 20));
    }
    return got.messages;
  };
  return got;
}

const subject = (m) => m.data.match(/^Subject: (.*)$/m)?.[1];
const smtpEnv = (port, extra = {}) => ({
  NOTIFY_EMAIL: 'operator@example.test',
  SMTP_HOST: '127.0.0.1',
  SMTP_PORT: String(port),
  SMTP_TLS: 'none',
  SMTP_USER: 'sender@example.test',
  SMTP_PASS: 'app-password-for-tests',
  ...extra,
});

test('OM-01 the mailer signs in, sends headers and a dot-stuffed body, and reports a refusal', async () => {
  const smtp = await fakeSmtp();
  const opts = {
    host: '127.0.0.1',
    port: smtp.port,
    tls: 'none',
    user: 'sender@example.test',
    pass: 'secret pass',
    from: 'sender@example.test',
  };
  try {
    await sendMail(opts, {
      to: ['a@example.test', 'b@example.test'],
      subject: 'Hello ★',
      text: 'line one\n.starts with a dot\nend',
    });
    const [m] = smtp.messages;
    assert.equal(smtp.auth[0], '\0sender@example.test\0secret pass');
    assert.equal(m.from, '<sender@example.test>');
    assert.deepEqual(m.to, ['<a@example.test>', '<b@example.test>']);
    assert.match(m.data, /^From: Little Wins <sender@example.test>$/m);
    assert.match(m.data, /^To: a@example.test, b@example.test$/m);
    assert.match(m.data, /^Subject: =\?UTF-8\?B\?/m, 'a non-ASCII subject is encoded');
    assert.match(m.data, /\r\n\r\nline one\r\n\.\.starts with a dot\r\nend$/);
  } finally {
    await smtp.close();
  }
  const refusing = await fakeSmtp({ reject: true });
  try {
    await assert.rejects(
      sendMail(
        { ...opts, port: refusing.port },
        { to: ['a@example.test'], subject: 's', text: 't' },
      ),
      /AUTH: 535/,
    );
    assert.equal(refusing.messages.length, 0);
  } finally {
    await refusing.close();
  }
});

test('OM-02 sign-ups, the last place, a parent turned away and a deletion each send one email, with counts only', async () => {
  const smtp = await fakeSmtp();
  const srv = await startServer({
    signup: 'open',
    env: { ...smtpEnv(smtp.port), LIMIT_FAMILIES: '2' },
  });
  try {
    const A = await srv.newFamily({ name: 'Secretname Family', child: 'Secretkid' });
    let got = await smtp.wait(1);
    assert.equal(subject(got[0]), 'Little Wins: a new family signed up (1 of 2)');
    assert.deepEqual(got[0].to, ['<operator@example.test>']);
    await srv.newFamily();
    got = await smtp.wait(3);
    assert.equal(subject(got[1]), 'Little Wins: a new family signed up (2 of 2)');
    assert.equal(subject(got[2]), 'Little Wins: full (2 of 2)');

    // A third parent signs in: full. Polling the state again sends nothing more today.
    const late = jar();
    assert.ok(
      (
        await srv.signIn(late, 'google', {
          sub: 'late-parent',
          email: 'late-parent@example.test',
          name: 'Latecomer',
        })
      ).ok,
    );
    assert.equal((await srv.api(late, '/api/state')).json.full, true);
    await srv.api(late, '/api/state');
    const refused = await srv.api(late, '/api/setup', {
      family_name: 'Late',
      child_name: 'Kid',
      timezone: 'UTC',
    });
    assert.equal(refused.status, 409);
    got = await smtp.wait(4);
    assert.equal(subject(got[3]), 'Little Wins: a parent was turned away (2 of 2)');

    const del = await srv.api(A.jar, '/api/family/delete', { confirm: 'Secretname Family' });
    assert.equal(del.status, 200);
    got = await smtp.wait(5);
    assert.equal(subject(got[4]), 'Little Wins: a family was deleted (1 of 2)');

    await new Promise((ok) => setTimeout(ok, 200));
    assert.equal(smtp.messages.length, 5, 'no other email');
    for (const m of smtp.messages) {
      assert.doesNotMatch(m.data, /Secretname|Secretkid|late-parent|Latecomer/);
      assert.doesNotMatch(m.data.split('\r\n\r\n').slice(1).join(), /@/, 'no email in the body');
    }
  } finally {
    await srv.close();
    await smtp.close();
  }
});

test('OM-03 NOTIFY_EVENTS picks the emails; a mail server that fails never breaks sign-up', async () => {
  const smtp = await fakeSmtp();
  const srv = await startServer({
    signup: 'open',
    env: { ...smtpEnv(smtp.port), LIMIT_FAMILIES: '1', NOTIFY_EVENTS: 'full' },
  });
  try {
    await srv.newFamily();
    const got = await smtp.wait(1);
    assert.equal(subject(got[0]), 'Little Wins: full (1 of 1)');
    await new Promise((ok) => setTimeout(ok, 200));
    assert.equal(smtp.messages.length, 1, 'no sign-up email');
  } finally {
    await srv.close();
    await smtp.close();
  }

  // Nothing listens on this port: setting up a family still works, and the failure is logged.
  const port = await new Promise((ok) => {
    const probe = net.createServer().listen(0, '127.0.0.1', () => {
      const p = probe.address().port;
      probe.close(() => ok(p));
    });
  });
  const srv2 = await startServer({ signup: 'open', env: smtpEnv(port) });
  try {
    const f = await srv2.newFamily();
    assert.ok(f.childId);
    const until = Date.now() + 5000;
    while (!/Could not send the "signup" email/.test(srv2.output()) && Date.now() < until)
      await new Promise((ok) => setTimeout(ok, 20));
    assert.match(srv2.output(), /Could not send the "signup" email/);
    assert.doesNotMatch(srv2.output(), /app-password-for-tests/);
  } finally {
    await srv2.close();
  }
});

test('OM-04 the server refuses incomplete or unsafe email settings', async () => {
  const base = {
    PORT: '0',
    DATABASE_PATH: path.join(tmpDir('alerts'), 'x.db'),
    APP_BASE_URL: 'http://localhost:3999',
    LITTLE_WINS_FAKE_SSO: '1',
  };
  let r = await startFails({ ...base, NOTIFY_EMAIL: 'operator@example.test' });
  for (const m of [/SMTP_HOST is required/, /SMTP_USER is required/, /SMTP_PASS is required/])
    assert.match(r.out, m);
  r = await startFails({ ...base, ...smtpEnv(465, { SMTP_HOST: 'smtp.example.test' }) });
  assert.match(r.out, /SMTP_TLS=none is only allowed when SMTP_HOST is localhost/);
  r = await startFails({
    ...base,
    ...smtpEnv(465, { NOTIFY_EVENTS: 'signup,birthdays', NOTIFY_EMAIL: 'not an email' }),
  });
  assert.match(r.out, /NOTIFY_EVENTS: unknown birthdays/);
  assert.match(r.out, /NOTIFY_EMAIL must be/);
});

test('OM-05 idle deletions say how many; a turned-away email goes at most once a day', async () => {
  const sent = [];
  let families = 5;
  let day = '2026-11-18T10:00:00Z';
  const alerts = createAlerts({
    repo: { familyCount: () => families },
    notify: {
      to: ['operator@example.test'],
      events: new Set(['deleted', 'turned-away']),
      smtp: {},
    },
    send: async (_smtp, m) => sent.push(m),
    now: () => new Date(day),
    limit: 5,
    site: 'https://little.example.test',
    idleDays: 365,
  });
  alerts.turnedAway();
  alerts.turnedAway();
  day = '2026-11-19T09:00:00Z';
  alerts.turnedAway();
  families = 2;
  alerts.familyDeleted('idle', 3);
  alerts.familyCreated(); // not among the chosen events
  await alerts.idle();
  assert.deepEqual(
    sent.map((m) => m.subject),
    [
      'Little Wins: a parent was turned away (5 of 5)',
      'Little Wins: a parent was turned away (5 of 5)',
      'Little Wins: 3 families were deleted (2 of 5)',
    ],
  );
  assert.match(sent[2].text, /3 families were deleted after 365 days without use\./);
  assert.match(sent[2].text, /It now holds 2 families \(limit 5\)\./);
  assert.match(sent[2].text, /-- Little Wins at https:\/\/little\.example\.test/);
});
