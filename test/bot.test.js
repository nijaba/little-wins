// The Telegram bot (bot/): the welcome check, answers about the app, issue drafts and settings.
// Telegram, GitHub and Claude are fakes here; nothing leaves the machine.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { tmpDir, removeDir } = require('./helpers');
const { readConfig } = require('../bot/src/config');
const { createStore } = require('../bot/src/store');
const { createVerifier, EMOJI, STAR } = require('../bot/src/verify');
const { createAnswerer, HINTS } = require('../bot/src/answer');
const { createBot } = require('../bot/src/bot');

const CHAT = '-1001234';
const ME = { id: 999, username: 'lw_helper_bot' };

/** A fake Telegram: records every call, answers what the bot needs. */
function fakeTelegram() {
  const calls = [];
  let nextId = 100;
  return {
    calls,
    named: (m) => calls.filter((c) => c.method === m),
    async call(method, params = {}) {
      calls.push({ method, params });
      if (method === 'sendMessage') return { message_id: nextId++ };
      if (method === 'getChat')
        return { permissions: { can_send_messages: true, can_send_photos: true } };
      return true;
    },
  };
}

/** A fake Claude client: returns `out` as the JSON answer and records the requests. */
function fakeClaude(out, extra = {}) {
  const requests = [];
  return {
    requests,
    messages: {
      async create(req) {
        requests.push(req);
        if (extra.fail) throw Object.assign(new Error('down'), { status: 529 });
        return {
          stop_reason: extra.stop || 'end_turn',
          content: [
            { type: 'thinking', thinking: '' },
            { type: 'text', text: JSON.stringify(out) },
          ],
        };
      },
    },
  };
}

function setup({
  out,
  claude,
  github,
  now = () => Date.parse('2026-11-18T12:00:00Z'),
  perUserPerHour = 10,
  perDay = 300,
} = {}) {
  const tg = fakeTelegram();
  const store = createStore(null);
  const logs = [];
  const log = (m) => logs.push(m);
  let i = 0;
  const random = () => [0.1, 0.9, 0.5, 0.3, 0.7, 0.2][i++ % 6];
  const verifier = createVerifier({
    tg,
    store,
    chatId: CHAT,
    minutes: 5,
    tries: 3,
    now,
    random,
    log,
  });
  const client =
    claude ||
    fakeClaude(
      out || {
        about_little_wins: true,
        kind: 'question',
        reply: 'Tap +.',
        issue_title: '',
        issue_body: '',
      },
    );
  const answerer = createAnswerer({
    client,
    model: 'claude-haiku-5-5',
    knowledge: 'THE GUIDES',
    perUserPerHour,
    perDay,
    github,
    issuesPerDay: 2,
    now,
    log,
  });
  const bot = createBot({ tg, me: ME, chatId: CHAT, verifier, answerer, store, now, log });
  return { tg, store, verifier, answerer, bot, client, logs };
}

const join = (user) => ({
  chat_member: {
    chat: { id: Number(CHAT) },
    old_chat_member: { status: 'left', user },
    new_chat_member: { status: 'member', user },
  },
});
const tap = (from, data, id = 'q1') => ({
  callback_query: {
    id,
    from,
    data,
    message: { chat: { id: Number(CHAT) }, message_id: 100, text: 'x' },
  },
});
const say = (from, text, more = {}) => ({
  message: { message_id: 7, chat: { id: Number(CHAT), type: 'supergroup' }, from, text, ...more },
});
const starData = (tg, userId) => {
  const markup = tg.named('sendMessage').at(-1).params.reply_markup;
  return markup.inline_keyboard
    .flat()
    .find((b) => b.text === STAR)
    .callback_data.replace(/^v:\d+/, `v:${userId}`);
};
const wrongData = (tg, userId) =>
  tg
    .named('sendMessage')
    .at(-1)
    .params.reply_markup.inline_keyboard.flat()
    .find((b) => b.text !== STAR)
    .callback_data.replace(/^v:\d+/, `v:${userId}`);

test('BT-01 a new member is muted and welcomed with six shuffled emoji; tapping the star lets them post', async () => {
  const { tg, bot, verifier, logs } = setup();
  const alice = { id: 1, first_name: 'Alice' };
  await bot.onUpdate(join(alice));
  assert.equal(tg.named('restrictChatMember')[0].params.permissions.can_send_messages, false);
  const welcome = tg.named('sendMessage')[0].params;
  assert.match(welcome.text, /tap the star ⭐ below within 5 minutes/);
  assert.match(welcome.text, /Claude \(Anthropic's AI\)/, 'says who answers');
  const buttons = welcome.reply_markup.inline_keyboard.flat().map((b) => b.text);
  assert.deepEqual([...buttons].sort(), [...EMOJI].sort());
  assert.notDeepEqual(buttons, EMOJI, 'shuffled');
  assert.ok(verifier.isPending(1));
  // Someone else's tap doesn't count.
  await bot.onUpdate(tap({ id: 2 }, starData(tg, 1)));
  assert.match(tg.named('answerCallbackQuery').at(-1).params.text, /for the new member/);
  assert.ok(verifier.isPending(1));
  await bot.onUpdate(tap(alice, starData(tg, 1)));
  assert.equal(verifier.isPending(1), false);
  assert.equal(
    tg.named('restrictChatMember').at(-1).params.permissions.can_send_messages,
    true,
    "the group's own permissions",
  );
  assert.match(tg.named('editMessageText').at(-1).params.text, /Welcome, Alice!/);
  assert.deepEqual(logs, ['Verified a new member'], 'no names in the log');
});

test('BT-02 wrong taps reshuffle; the third, or five minutes without a tap, removes the member (who may rejoin)', async () => {
  let t = Date.parse('2026-11-18T12:00:00Z');
  const { tg, bot, verifier } = setup({ now: () => t });
  const bob = { id: 3, first_name: 'Bob' };
  await bot.onUpdate(join(bob));
  for (let k = 0; k < 2; k++) await bot.onUpdate(tap(bob, wrongData(tg, 3)));
  assert.equal(tg.named('editMessageReplyMarkup').length, 2, 'reshuffled after each wrong tap');
  assert.ok(verifier.isPending(3));
  await bot.onUpdate(tap(bob, wrongData(tg, 3)));
  assert.equal(verifier.isPending(3), false);
  assert.equal(tg.named('banChatMember').length, 1);
  assert.equal(tg.named('unbanChatMember')[0].params.only_if_banned, true, 'a kick, not a ban');
  assert.equal(tg.named('deleteMessage').length, 1, 'the welcome goes');
  // Time runs out for the next one.
  const cara = { id: 4, first_name: 'Cara' };
  await bot.onUpdate(join(cara));
  t += 4 * 60e3;
  await verifier.sweep();
  assert.ok(verifier.isPending(4), 'still has time');
  t += 61e3;
  await verifier.sweep();
  assert.equal(verifier.isPending(4), false);
  assert.equal(tg.named('banChatMember').length, 2);
});

test('BT-03 a member who leaves before passing is tidied up; bots and repeat joins are not checked', async () => {
  const { tg, bot, verifier } = setup();
  const dan = { id: 5, first_name: 'Dan' };
  await bot.onUpdate(join(dan));
  await bot.onUpdate(join(dan));
  assert.equal(tg.named('sendMessage').length, 1, 'one welcome');
  await bot.onUpdate({
    chat_member: {
      chat: { id: Number(CHAT) },
      old_chat_member: { status: 'restricted', user: dan },
      new_chat_member: { status: 'left', user: dan },
    },
  });
  assert.equal(verifier.isPending(5), false);
  assert.equal(tg.named('deleteMessage').length, 1);
  await bot.onUpdate(join({ id: 6, first_name: 'Robo', is_bot: true }));
  assert.equal(tg.named('restrictChatMember').length, 1, 'only Dan was muted');
});

test('BT-04 the state file keeps a pending check across a restart', () => {
  const dir = tmpDir('bot-state');
  try {
    const a = createStore(dir);
    a.state.pending['7'] = { messageId: 1, deadline: 1, wrong: 0, name: 'E' };
    a.save();
    const b = createStore(dir);
    assert.deepEqual(b.state.pending['7'], { messageId: 1, deadline: 1, wrong: 0, name: 'E' });
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'state.json'), 'utf8')).drafts, {});
  } finally {
    removeDir(dir);
  }
});

test('BT-05 a question gets an answer from Claude with the guides cached; chat that is not a question never reaches Claude', async () => {
  const { tg, bot, client } = setup();
  const eve = { id: 8, first_name: 'Eve' };
  await bot.onUpdate(say(eve, 'lol nice'));
  await bot.onUpdate(say(eve, 'good morning everyone, coffee time'));
  assert.equal(client.requests.length, 0, 'no question words: no call');
  await bot.onUpdate(say(eve, 'How do I add a second child?'));
  assert.equal(client.requests.length, 1);
  const req = client.requests[0];
  assert.equal(req.model, 'claude-haiku-5-5');
  assert.equal(req.system[1].text, 'THE GUIDES');
  assert.deepEqual(req.system[1].cache_control, { type: 'ephemeral' });
  assert.equal(req.output_config.format.type, 'json_schema');
  assert.equal(req.output_config.effort, 'low');
  assert.equal(req.temperature, undefined, 'no sampling parameters');
  assert.match(
    req.messages[0].content,
    /<message directed="no">\nHow do I add a second child\?\n<\/message>/,
  );
  const sent = tg.named('sendMessage').at(-1).params;
  assert.equal(sent.text, 'Tap +.');
  assert.equal(sent.reply_parameters.message_id, 7);
  assert.equal(sent.parse_mode, undefined, 'plain text');
  // Questions in the other languages pass the cheap filter too.
  for (const q of [
    'Comment ajouter un enfant ?',
    '¿Cómo cambio el idioma?',
    'Wie ändere ich die Sprache',
    '怎么添加孩子',
  ])
    assert.match(q, HINTS, q);
});

test('BT-06 off-topic: silent when not asked, a short decline when asked directly; refusals and failures stay safe', async () => {
  const off = {
    about_little_wins: false,
    kind: 'other',
    reply: 'I only help with Little Wins.',
    issue_title: '',
    issue_body: '',
  };
  const { tg, bot } = setup({ out: off });
  const fay = { id: 9, first_name: 'Fay' };
  await bot.onUpdate(say(fay, "What's the weather like tomorrow?"));
  assert.equal(tg.named('sendMessage').length, 0, 'not asked: says nothing');
  const text = '@lw_helper_bot what is the capital of France?';
  await bot.onUpdate(say(fay, text, { entities: [{ type: 'mention', offset: 0, length: 14 }] }));
  assert.equal(tg.named('sendMessage').at(-1).params.text, 'I only help with Little Wins.');
  // A reply to the bot is directed too; a refusal or a failed call never leaks anything.
  for (const extra of [{ stop: 'refusal' }, { fail: true }]) {
    const s = setup({ claude: fakeClaude(off, extra) });
    await s.bot.onUpdate(
      say(fay, 'and why?', { reply_to_message: { from: { id: ME.id }, text: 'earlier answer' } }),
    );
    assert.match(
      s.tg.named('sendMessage').at(-1).params.text,
      /only help with questions about the Little Wins app|can't answer right now/,
    );
    assert.match(
      s.client.requests[0].messages[0].content,
      /<replied-to>\nearlier answer\n<\/replied-to>/,
    );
  }
});

test('BT-07 limits per person per hour and per day', async () => {
  const { tg, bot, client } = setup({ perUserPerHour: 2, perDay: 3 });
  const gus = { id: 10, first_name: 'Gus' };
  const dm = (from, text) => ({
    message: { message_id: 1, chat: { id: from.id, type: 'private' }, from, text },
  });
  for (let k = 0; k < 3; k++) await bot.onUpdate(dm(gus, `How do stars work, part ${k}?`));
  assert.equal(client.requests.length, 2);
  assert.match(tg.named('sendMessage').at(-1).params.text, /try again later/);
  await bot.onUpdate(dm({ id: 11 }, 'How do rewards work?'));
  await bot.onUpdate(dm({ id: 12 }, 'How do rewards work?'));
  assert.equal(client.requests.length, 3, 'the daily cap');
});

test('BT-08 a bug report gets a draft; only its author can open the issue, which is summarized, labeled and capped', async () => {
  const bug = {
    about_little_wins: true,
    kind: 'bug',
    reply: 'Try reloading the page.',
    issue_title: 'Week tab shows stars twice',
    issue_body: 'On the Week tab, each star appears twice after marking a day.',
  };
  const opened = [];
  const github = {
    async openIssue(i) {
      opened.push(i);
      return {
        number: 50 + opened.length,
        url: `https://github.com/example/repo/issues/${50 + opened.length}`,
      };
    },
  };
  const { tg, bot, store, logs } = setup({ out: bug, github });
  const hal = { id: 13, first_name: 'Hal' };
  await bot.onUpdate(say(hal, 'Bug: the week tab shows every star twice, is that broken?'));
  const msg = tg.named('sendMessage').at(-1).params;
  assert.match(
    msg.text,
    /Try reloading the page\.\n\nWant me to open a GitHub bug report\? Draft title: "Week tab shows stars twice"/,
  );
  const data = msg.reply_markup.inline_keyboard[0][0].callback_data;
  assert.match(data, /^i:[\w-]+$/);
  const q = (from) => ({
    callback_query: {
      id: 'c',
      from,
      data,
      message: { chat: { id: Number(CHAT) }, message_id: 101, text: msg.text },
    },
  });
  await bot.onUpdate(q({ id: 14 }));
  assert.match(tg.named('answerCallbackQuery').at(-1).params.text, /Only the person who wrote it/);
  assert.equal(opened.length, 0);
  await bot.onUpdate(q(hal));
  assert.equal(opened.length, 1);
  assert.deepEqual(opened[0].labels, ['bug', 'from-telegram']);
  assert.equal(opened[0].title, 'Week tab shows stars twice');
  assert.doesNotMatch(opened[0].body, /Hal/, 'no name in the issue');
  assert.match(
    tg.named('editMessageText').at(-1).params.text,
    /Opened issue #51: https:\/\/github\.com\/example\/repo\/issues\/51/,
  );
  assert.equal(Object.keys(store.state.drafts).length, 0, 'used up');
  await bot.onUpdate(q(hal));
  assert.match(tg.named('answerCallbackQuery').at(-1).params.text, /expired/, 'once only');
  // The daily cap (2 here).
  for (let k = 0; k < 2; k++) {
    await bot.onUpdate(say(hal, `Bug ${k}: is the history broken?`));
    const d = tg.named('sendMessage').at(-1).params;
    await bot.onUpdate({
      callback_query: {
        id: 'c',
        from: hal,
        data: d.reply_markup.inline_keyboard[0][0].callback_data,
        message: { chat: { id: Number(CHAT) }, message_id: 102, text: d.text },
      },
    });
  }
  assert.equal(opened.length, 2);
  assert.match(tg.named('answerCallbackQuery').at(-1).params.text, /enough issues for today/);
  assert.ok(
    logs.every((l) => !/Hal|stars twice/.test(l)),
    'no content in the log',
  );
  // Without a GitHub token, no draft is offered.
  const plain = setup({ out: bug });
  await plain.bot.onUpdate(say(hal, 'Bug: is the week tab broken?'));
  assert.equal(plain.tg.named('sendMessage').at(-1).params.reply_markup, undefined);
});

test('BT-09 the bot leaves groups it does not serve, and ignores members still being checked', async () => {
  const { tg, bot, client } = setup();
  await bot.onUpdate({
    message: { message_id: 1, chat: { id: -555, type: 'group' }, from: { id: 1 }, text: 'How?' },
  });
  assert.equal(tg.named('leaveChat')[0].params.chat_id, -555);
  const ivy = { id: 15, first_name: 'Ivy' };
  await bot.onUpdate(join(ivy));
  await bot.onUpdate(say(ivy, 'How do I install it on my phone?'));
  assert.equal(client.requests.length, 0);
});

test('BT-10 the bot refuses to start without its token, chat ID format, Claude key, or with half a GitHub setup', () => {
  const ok = { TELEGRAM_BOT_TOKEN: `123456:${'a'.repeat(35)}`, ANTHROPIC_API_KEY: 'sk-ant-test' };
  assert.deepEqual(readConfig(ok).problems, []);
  assert.equal(readConfig(ok).model, 'claude-haiku-5-5');
  assert.equal(readConfig(ok).chatId, '', 'discovery mode');
  assert.equal(readConfig(ok).github, null);
  for (const [env, re] of [
    [{ ...ok, TELEGRAM_BOT_TOKEN: '' }, /TELEGRAM_BOT_TOKEN/],
    [{ ...ok, TELEGRAM_CHAT_ID: 'the-group' }, /TELEGRAM_CHAT_ID/],
    [{ ...ok, ANTHROPIC_API_KEY: '<key from the Claude Console>' }, /ANTHROPIC_API_KEY/],
    [{ ...ok, GITHUB_TOKEN: 'x' }, /GITHUB_REPO/],
    [{ ...ok, GITHUB_REPO: 'a/b' }, /GITHUB_TOKEN/],
    [{ ...ok, VERIFY_MINUTES: '0' }, /VERIFY_MINUTES/],
  ])
    assert.match(readConfig(env).problems.join('\n'), re);
  const gh = readConfig({
    ...ok,
    GITHUB_TOKEN: 'x',
    GITHUB_REPO: 'a/b',
    TELEGRAM_CHAT_ID: '-100123',
  });
  assert.deepEqual(gh.github, { token: 'x', repo: 'a/b' });
  // The example file names every setting the bot reads.
  const example = fs.readFileSync(path.join(__dirname, '..', 'bot', '.env.example'), 'utf8');
  for (const name of [
    'TELEGRAM_BOT_TOKEN',
    'TELEGRAM_CHAT_ID',
    'ANTHROPIC_API_KEY',
    'BOT_MODEL',
    'VERIFY_MINUTES',
    'VERIFY_TRIES',
    'ANSWERS_PER_USER_PER_HOUR',
    'ANSWERS_PER_DAY',
    'GITHUB_TOKEN',
    'GITHUB_REPO',
    'ISSUES_PER_DAY',
  ])
    assert.match(example, new RegExp(`^#? ?${name}=`, 'm'), name);
});
