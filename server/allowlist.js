/**
 * PARENT_ALLOWLIST: who may create a family when sign-up is closed (or claim a family that
 * has no parents). Comma-separated entries:
 *   *                          anyone who signs in
 *   google:ana@example.com     that Google account, by verified email
 *   github:ana-dev             that GitHub login
 *   google-domain:example.com  any account in that Google Workspace (the `hd` claim)
 */

function parseAllowlist(text) {
  const entries = [];
  const invalid = [];
  for (const raw of text.split(',')) {
    const entry = raw.trim();
    if (!entry) continue;
    if (entry === '*') {
      entries.push({ type: 'any' });
      continue;
    }
    const match = /^(google|github|google-domain):(.+)$/.exec(entry);
    if (!match) {
      invalid.push(entry);
      continue;
    }
    entries.push({ type: match[1], value: match[2].trim().toLowerCase() });
  }
  return { entries, invalid };
}

/** Does this signed-in identity match an allowlist entry? Never matches on display name. */
function allows(allowlist, identity) {
  return allowlist.entries.some((e) => {
    if (e.type === 'any') return true;
    if (e.type === 'google') return identity.provider === 'google' && identity.email === e.value;
    if (e.type === 'github')
      return identity.provider === 'github' && (identity.login || '').toLowerCase() === e.value;
    if (e.type === 'google-domain')
      return identity.provider === 'google' && identity.domain === e.value;
    return false;
  });
}

module.exports = { parseAllowlist, allows };
