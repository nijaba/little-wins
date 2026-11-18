/**
 * The bot's settings, from environment variables (bot/.env). `problems` lists anything that must
 * stop it from starting; index.js prints them and exits. See docs/admin-guide.md, "The Telegram bot".
 */
function readConfig(env = process.env) {
  const problems = [];
  const whole = (name, fallback, min = 1) => {
    const raw = env[name];
    if (raw === undefined || raw === '') return fallback;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < min) {
      problems.push(`${name} must be a whole number of at least ${min}`);
      return fallback;
    }
    return n;
  };

  const token = env.TELEGRAM_BOT_TOKEN || '';
  if (!/^\d+:[\w-]{30,}$/.test(token))
    problems.push('TELEGRAM_BOT_TOKEN must be the token BotFather gave you (digits:letters)');
  // The one group the bot serves. Empty: discovery mode, the bot only logs the chats it sees.
  const chatId = env.TELEGRAM_CHAT_ID || '';
  if (chatId && !/^-?\d+$/.test(chatId)) problems.push('TELEGRAM_CHAT_ID must be a chat ID (a number, often negative)');
  const anthropicKey = env.ANTHROPIC_API_KEY || '';
  if (!anthropicKey || /change-me|<.*>/.test(anthropicKey))
    problems.push('ANTHROPIC_API_KEY must be set (an API key from the Claude Console)');

  // GitHub issues from bug reports and ideas (optional): both or neither.
  const githubToken = env.GITHUB_TOKEN || '';
  const githubRepo = env.GITHUB_REPO || '';
  if (githubToken && !/^[\w/.-]+\/[\w.-]+$/.test(githubRepo))
    problems.push('GITHUB_REPO must be owner/name when GITHUB_TOKEN is set');
  if (githubRepo && !githubToken) problems.push('GITHUB_TOKEN must be set when GITHUB_REPO is set');

  return {
    token,
    chatId,
    anthropicKey,
    model: env.BOT_MODEL || 'claude-haiku-5-5',
    verifyMinutes: whole('VERIFY_MINUTES', 5),
    verifyTries: whole('VERIFY_TRIES', 3),
    answersPerUserPerHour: whole('ANSWERS_PER_USER_PER_HOUR', 10),
    answersPerDay: whole('ANSWERS_PER_DAY', 300),
    github: githubToken ? { token: githubToken, repo: githubRepo } : null,
    issuesPerDay: whole('ISSUES_PER_DAY', 5),
    dataDir: env.BOT_DATA || '/data',
    knowledgeDir: env.BOT_KNOWLEDGE || `${__dirname}/../knowledge`,
    problems,
  };
}

module.exports = { readConfig };
