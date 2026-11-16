/**
 * A small fixed-window rate limiter, in memory (one process, per the design).
 * `hit(key)` returns 0 when allowed, or the seconds to wait.
 */
function createRateLimiter({ max, windowMs }) {
  const windows = new Map();
  return {
    hit(key, now = Date.now()) {
      let w = windows.get(key);
      if (!w || now >= w.reset) {
        w = { count: 0, reset: now + windowMs };
        windows.set(key, w);
      }
      w.count++;
      if (windows.size > 10000) {
        for (const [k, v] of windows) if (now >= v.reset) windows.delete(k);
      }
      return w.count > max ? Math.ceil((w.reset - now) / 1000) : 0;
    },
  };
}

/** The client's address, as worked out by web.clientInfo (trusted proxies only). */
const clientIp = (req) => req.lw?.ip || req.socket.remoteAddress || 'unknown';

module.exports = { createRateLimiter, clientIp };
