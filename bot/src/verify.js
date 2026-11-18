/**
 * The welcome check: a new member can't post until they tap the star among six emoji buttons.
 * Only their own taps count. A wrong tap reshuffles; too many wrong taps, or no tap in time,
 * removes them (a kick: they may join again later). See docs/design.md, "The Telegram bot".
 */
const EMOJI = ['⭐', '🍎', '🚗', '🐟', '🎈', '🌙'];
const STAR = '⭐';
const MUTED = {
  can_send_messages: false,
  can_send_audios: false,
  can_send_documents: false,
  can_send_photos: false,
  can_send_videos: false,
  can_send_video_notes: false,
  can_send_voice_notes: false,
  can_send_polls: false,
  can_send_other_messages: false,
  can_add_web_page_previews: false,
};

function shuffle(list, random) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function createVerifier({ tg, store, chatId, minutes, tries, now = Date.now, random = Math.random, log = console.log }) {
  const pending = store.state.pending;
  const keyboard = (userId) => {
    const row = shuffle(EMOJI, random).map((e) => ({ text: e, callback_data: `v:${userId}:${EMOJI.indexOf(e)}` }));
    return { inline_keyboard: [row.slice(0, 3), row.slice(3)] };
  };

  async function onJoin(user) {
    if (user.is_bot || pending[user.id]) return; // bots are added by admins on purpose
    await tg.call('restrictChatMember', { chat_id: chatId, user_id: user.id, permissions: MUTED });
    const name = (user.first_name || 'there').slice(0, 40);
    const msg = await tg.call('sendMessage', {
      chat_id: chatId,
      text: `Welcome to the Little Wins group, ${name}! To show you're a person, tap the star ${STAR} below within ${minutes} minutes.\n\nI'm a bot. I also answer questions about the Little Wins app, using Claude (Anthropic's AI), and can turn a bug report or an idea into a GitHub issue. Please don't share personal details in questions.`,
      reply_markup: keyboard(user.id),
    });
    pending[user.id] = { messageId: msg.message_id, deadline: now() + minutes * 60e3, wrong: 0, name };
    store.save();
  }

  /** Removes a member who didn't pass: kick (ban, then unban so they may come back later). */
  async function remove(userId, why) {
    const p = pending[userId];
    delete pending[userId];
    store.save();
    await tg.call('banChatMember', { chat_id: chatId, user_id: Number(userId) }).catch(() => {});
    await tg.call('unbanChatMember', { chat_id: chatId, user_id: Number(userId), only_if_banned: true }).catch(() => {});
    if (p) await tg.call('deleteMessage', { chat_id: chatId, message_id: p.messageId }).catch(() => {});
    log(`Removed a new member (${why})`);
  }

  /** A tap on one of the welcome's buttons. Returns true when it was one. */
  async function onCallback(q) {
    const m = /^v:(\d+):(\d)$/.exec(q.data || '');
    if (!m) return false;
    const [, userId, index] = m;
    const p = pending[userId];
    if (!p) {
      await tg.call('answerCallbackQuery', { callback_query_id: q.id });
      return true;
    }
    if (String(q.from.id) !== userId) {
      await tg.call('answerCallbackQuery', { callback_query_id: q.id, text: 'This one is for the new member.' });
      return true;
    }
    if (EMOJI[Number(index)] === STAR) {
      delete pending[userId];
      store.save();
      // Back to the group's own permissions.
      const chat = await tg.call('getChat', { chat_id: chatId });
      await tg.call('restrictChatMember', {
        chat_id: chatId,
        user_id: Number(userId),
        permissions: chat.permissions || { ...Object.fromEntries(Object.keys(MUTED).map((k) => [k, true])) },
      });
      await tg.call('answerCallbackQuery', { callback_query_id: q.id, text: 'Thanks!' });
      await tg.call('editMessageText', {
        chat_id: chatId,
        message_id: p.messageId,
        text: `Welcome, ${p.name}! 🎉 Ask me anything about the Little Wins app, or tell us how it's going.`,
      });
      log('Verified a new member');
      return true;
    }
    p.wrong += 1;
    store.save();
    if (p.wrong >= tries) {
      await tg.call('answerCallbackQuery', { callback_query_id: q.id });
      await remove(userId, 'wrong taps');
      return true;
    }
    await tg.call('answerCallbackQuery', { callback_query_id: q.id, text: `Not quite: tap the star ${STAR}.` });
    await tg.call('editMessageReplyMarkup', { chat_id: chatId, message_id: p.messageId, reply_markup: keyboard(userId) });
    return true;
  }

  /** A member who left before passing: tidy up. */
  async function onLeave(user) {
    const p = pending[user.id];
    if (!p) return;
    delete pending[user.id];
    store.save();
    await tg.call('deleteMessage', { chat_id: chatId, message_id: p.messageId }).catch(() => {});
  }

  /** Removes everyone whose time ran out. */
  async function sweep() {
    for (const [userId, p] of Object.entries(pending)) if (p.deadline <= now()) await remove(userId, 'no answer in time');
  }

  const isPending = (userId) => !!pending[userId];
  return { onJoin, onCallback, onLeave, sweep, isPending };
}

module.exports = { createVerifier, EMOJI, STAR };
