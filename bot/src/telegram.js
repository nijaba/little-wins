/** A small Telegram Bot API client: POST JSON to a method, get its result or an error. */
function createTelegram({ token, fetchFn = fetch, base = 'https://api.telegram.org' }) {
  async function call(method, params = {}, { timeoutMs = 70_000 } = {}) {
    const r = await fetchFn(`${base}/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const j = await r.json().catch(() => ({}));
    if (!j.ok) {
      // Never include the token (it is in the URL) or the parameters in the error.
      const err = new Error(`Telegram ${method}: ${j.description || r.status}`);
      err.code = j.error_code || r.status;
      err.retryAfter = j.parameters?.retry_after;
      throw err;
    }
    return j.result;
  }
  return { call };
}

/** GitHub issues, with a token that may only read and write issues on one repository. */
function createGithub({ token, repo, fetchFn = fetch }) {
  async function openIssue({ title, body, labels }) {
    const post = (withLabels) =>
      fetchFn(`https://api.github.com/repos/${repo}/issues`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'little-wins-bot',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(withLabels ? { title, body, labels } : { title, body }),
        signal: AbortSignal.timeout(20_000),
      });
    let r = await post(true);
    // A label the repository doesn't have (and the token can't create): open it without labels.
    if (r.status === 422) r = await post(false);
    if (!r.ok) throw new Error(`GitHub: ${r.status}`);
    const j = await r.json();
    return { number: j.number, url: j.html_url };
  }
  return { openIssue };
}

module.exports = { createTelegram, createGithub };
