/**
 * The edge of every request: who the client is (believing forwarded headers only from trusted
 * proxies), the HTTPS redirect, and the security headers every response carries.
 */
const config = require('./config');

/** Strips the IPv4-mapped IPv6 prefix so "::ffff:127.0.0.1" matches "127.0.0.1". */
const normalize = (ip) => String(ip || '').replace(/^::ffff:/, '');

/**
 * The client's address and protocol. X-Forwarded-For / X-Forwarded-Proto count only when the
 * direct peer is a trusted proxy (FORWARDED_ALLOW_IPS). We take the LAST X-Forwarded-For entry:
 * the address our proxy itself saw, which the client can't forge.
 */
function clientInfo(req) {
  const peer = normalize(req.socket.remoteAddress);
  const trusted = config.forwardedAllow.includes('*') || config.forwardedAllow.includes(peer);
  let ip = peer;
  let proto = req.socket.encrypted ? 'https' : 'http';
  if (trusted) {
    const forwardedFor = String(req.headers['x-forwarded-for'] || '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    if (forwardedFor.length) ip = normalize(forwardedFor.at(-1));
    const forwardedProto = String(req.headers['x-forwarded-proto'] || '')
      .split(',')[0]
      .trim()
      .toLowerCase();
    if (forwardedProto === 'https' || forwardedProto === 'http') proto = forwardedProto;
  }
  return { ip: ip || 'unknown', proto, trusted };
}

const PERMISSIONS =
  'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()';

/** Headers every response carries (pages add their Content-Security-Policy themselves). */
function setSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', PERMISSIONS);
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  if (!config.isLocal) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
}

/**
 * Outside localhost, a plain-HTTP request is redirected (308) to the same path on APP_BASE_URL,
 * never to the Host the request named. /healthz answers over HTTP, for health checks.
 * Returns true when it redirected.
 */
function redirectToHttps(req, res, info, pathname) {
  if (config.isLocal || info.proto === 'https' || pathname === '/healthz') return false;
  const target = new URL(config.baseUrl);
  const asked = new URL(req.url, 'http://x');
  target.pathname = asked.pathname;
  target.search = asked.search;
  res.writeHead(308, { Location: target.toString(), 'Cache-Control': 'no-store' });
  res.end();
  return true;
}

module.exports = { clientInfo, setSecurityHeaders, redirectToHttps, normalize };
