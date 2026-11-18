// A small SMTP client for the operator's emails: implicit TLS (port 465), STARTTLS (587), or
// plain to localhost only (tests), with AUTH PLAIN. One message per connection. No dependency.
const net = require('node:net');
const tls = require('node:tls');
const crypto = require('node:crypto');

const TIMEOUT_MS = 20e3;

/** Reads SMTP replies (one or more lines; "250-…" continues, "250 …" ends) from a socket. */
function replies(socket) {
  let buf = '';
  let lines = [];
  const waiting = [];
  const ready = [];
  let failed = null;
  const deliver = (r) => (waiting.length ? waiting.shift().ok(r) : ready.push(r));
  const onData = (chunk) => {
    buf += chunk.toString('utf8');
    let i = buf.indexOf('\n');
    while (i >= 0) {
      const line = buf.slice(0, i).replace(/\r$/, '');
      buf = buf.slice(i + 1);
      lines.push(line);
      if (/^\d{3}(?: |$)/.test(line)) {
        deliver({ code: Number(line.slice(0, 3)), text: lines.join('\n') });
        lines = [];
      }
      i = buf.indexOf('\n');
    }
  };
  const onFail = (err) => {
    failed = err;
    while (waiting.length) waiting.shift().fail(err);
  };
  socket.on('data', onData);
  socket.on('error', onFail);
  socket.on('close', () => onFail(new Error('connection closed')));
  return {
    next: () =>
      ready.length
        ? Promise.resolve(ready.shift())
        : failed
          ? Promise.reject(failed)
          : new Promise((ok, fail) => waiting.push({ ok, fail })),
    stop: () => {
      socket.off('data', onData);
      socket.off('error', onFail);
      socket.removeAllListeners('close');
    },
  };
}

const oneLine = (s) => String(s).replace(/[\r\n]+/g, ' ');
// Non-ASCII subjects use RFC 2047 encoded words.
const header = (s) =>
  /^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s, 'utf8').toString('base64')}?=`;

/** The message: headers, a plain-text body with CRLF line ends and dot-stuffing. */
function message({ from, to, subject, text, date = new Date() }) {
  const domain = from.split('@')[1] || 'localhost';
  const body = String(text)
    .replace(/\r?\n/g, '\r\n')
    .split('\r\n')
    .map((l) => (l.startsWith('.') ? `.${l}` : l))
    .join('\r\n');
  return [
    `From: Little Wins <${from}>`,
    `To: ${to.join(', ')}`,
    `Subject: ${header(oneLine(subject))}`,
    `Date: ${date.toUTCString().replace('GMT', '+0000')}`,
    `Message-ID: <${crypto.randomUUID()}@${domain}>`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    body,
  ].join('\r\n');
}

/**
 * Sends one message. smtp: { host, port, tls ('tls' | 'starttls' | 'none'), user, pass, from }.
 * Resolves when the server accepted it; rejects with the server's reply otherwise.
 */
async function sendMail(smtp, { to, subject, text }) {
  const connect = () =>
    smtp.tls === 'tls'
      ? tls.connect({ host: smtp.host, port: smtp.port, servername: smtp.host })
      : net.connect({ host: smtp.host, port: smtp.port });
  let socket = connect();
  socket.setTimeout(TIMEOUT_MS, () => socket.destroy(new Error('timed out')));
  let r = replies(socket);
  const write = (line) => socket.write(`${line}\r\n`);
  const expect = async (code, what) => {
    const reply = await r.next();
    if (reply.code !== code) throw new Error(`${what}: ${reply.text.slice(0, 200)}`);
    return reply;
  };
  try {
    await expect(220, 'greeting');
    write('EHLO little-wins');
    let ehlo = await expect(250, 'EHLO');
    if (smtp.tls === 'starttls') {
      if (!/STARTTLS/i.test(ehlo.text)) throw new Error('the server does not offer STARTTLS');
      write('STARTTLS');
      await expect(220, 'STARTTLS');
      r.stop();
      socket = tls.connect({ socket, servername: smtp.host });
      socket.setTimeout(TIMEOUT_MS, () => socket.destroy(new Error('timed out')));
      r = replies(socket);
      await new Promise((ok, fail) => {
        socket.once('secureConnect', ok);
        socket.once('error', fail);
      });
      write('EHLO little-wins');
      ehlo = await expect(250, 'EHLO');
    }
    const auth = Buffer.from(`\0${smtp.user}\0${smtp.pass}`, 'utf8').toString('base64');
    write(`AUTH PLAIN ${auth}`);
    await expect(235, 'AUTH');
    write(`MAIL FROM:<${smtp.from}>`);
    await expect(250, 'MAIL FROM');
    for (const rcpt of to) {
      write(`RCPT TO:<${rcpt}>`);
      await expect(250, 'RCPT TO');
    }
    write('DATA');
    await expect(354, 'DATA');
    socket.write(`${message({ from: smtp.from, to, subject, text })}\r\n.\r\n`);
    await expect(250, 'message');
    write('QUIT');
  } finally {
    r.stop();
    socket.end();
    socket.destroySoon?.();
  }
}

module.exports = { sendMail, message };
