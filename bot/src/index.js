/**
 * The Little Wins Telegram bot: checks new members are people, answers questions about the app,
 * and offers to turn bug reports and ideas into GitHub issues. A separate, optional service with
 * its own container (bot/docker-compose.yml); the app doesn't need it. See docs/admin-guide.md.
 */
const fs = require('node:fs');
const path = require('node:path');
const { readConfig } = require('./config');
const { createTelegram, createGithub, createBackoff, untilItWorks } = require('./telegram');
const { createStore } = require('./store');
const { createVerifier } = require('./verify');
const { createAnswerer } = require('./answer');
const { createBot } = require('./bot');

const config = readConfig();
if (config.problems.length) {
  console.error(`Refusing to start:\n- ${config.problems.join('\n- ')}`);
  process.exit(1);
}

/** The app's own guides, copied into the image at build time: the bot's only source. */
function readKnowledge(dir) {
  return ['user-guide.md', 'admin-guide.md', 'design.md']
    .map((f) => `<document name="${f}">\n${fs.readFileSync(path.join(dir, f), 'utf8')}\n</document>`)
    .join('\n\n');
}

async function main() {
  const tg = createTelegram({ token: config.token });
  // Telegram can fail for a while (a 502 right after a bot is created, a network blip): wait and
  // try again, slower each time, instead of exiting and being restarted every few seconds.
  const backoff = createBackoff();
  const me = await untilItWorks(() => tg.call('getMe'), backoff);
  console.log(`Signed in to Telegram as @${me.username}`);
  let offset = 0;

  if (!config.chatId) {
    // Discovery: say which chats the bot is in, and do nothing else.
    console.log('TELEGRAM_CHAT_ID is not set: logging the chats I see, nothing else.');
    for (;;) {
      const updates = await untilItWorks(() => tg.call('getUpdates', { offset, timeout: 50 }), backoff);
      for (const u of updates) {
        offset = u.update_id + 1;
        const chat = u.message?.chat || u.my_chat_member?.chat;
        if (chat) console.log(`Chat ${chat.id} (${chat.type}${chat.title ? `: ${chat.title}` : ''})`);
      }
    }
  }

  // The Anthropic SDK is the bot's one runtime dependency (see docs/design.md).
  const Anthropic = require('@anthropic-ai/sdk').default;
  const client = new Anthropic({ apiKey: config.anthropicKey });
  const store = createStore(config.dataDir);
  const verifier = createVerifier({ tg, store, chatId: config.chatId, minutes: config.verifyMinutes, tries: config.verifyTries });
  const answerer = createAnswerer({
    client,
    model: config.model,
    knowledge: readKnowledge(config.knowledgeDir),
    perUserPerHour: config.answersPerUserPerHour,
    perDay: config.answersPerDay,
    github: config.github ? createGithub(config.github) : null,
    issuesPerDay: config.issuesPerDay,
  });
  const bot = createBot({ tg, me, chatId: config.chatId, verifier, answerer, store });

  setInterval(() => verifier.sweep().catch((err) => console.warn(`Sweep: ${err.message}`)), 15e3).unref();
  console.log(`Serving chat ${config.chatId} with ${config.model}${config.github ? `, issues on ${config.github.repo}` : ''}`);
  for (;;) {
    const updates = await untilItWorks(
      () => tg.call('getUpdates', { offset, timeout: 50, allowed_updates: ['message', 'callback_query', 'chat_member'] }),
      backoff,
    );
    for (const u of updates) {
      offset = u.update_id + 1;
      // One update at a time; a failure is logged (without content) and the bot moves on.
      await bot.onUpdate(u).catch((err) => console.warn(`Update failed: ${err.message}`));
    }
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
