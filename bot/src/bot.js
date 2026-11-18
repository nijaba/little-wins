/**
 * Routes Telegram updates: new members to the welcome check, button taps to the check or to an
 * issue draft, and messages to the answerer. Works in one group (TELEGRAM_CHAT_ID) and in private
 * chats; it leaves any other group it's added to.
 */
const DRAFT_TTL = 24 * 3600e3;

function createBot({ tg, me, chatId, verifier, answerer, store, now = Date.now, log = console.log }) {
  const drafts = store.state.drafts;
  const ours = (chat) => String(chat.id) === String(chatId);

  function mentioned(msg) {
    const text = msg.text || '';
    return (msg.entities || []).some(
      (e) => e.type === 'mention' && text.slice(e.offset, e.offset + e.length).toLowerCase() === `@${me.username}`.toLowerCase(),
    );
  }

  async function onMessage(msg) {
    const chat = msg.chat;
    if (chat.type !== 'private' && !ours(chat)) {
      log('Left a chat it does not serve');
      await tg.call('leaveChat', { chat_id: chat.id }).catch(() => {});
      return;
    }
    if (ours(chat)) for (const u of msg.new_chat_members || []) await verifier.onJoin(u);
    if (!msg.text || !msg.from || msg.from.is_bot || verifier.isPending(msg.from.id)) return;
    const directed = chat.type === 'private' || mentioned(msg) || msg.reply_to_message?.from?.id === me.id;
    const text = msg.text.replace(new RegExp(`@${me.username}\\b`, 'gi'), '').trim();
    const out = await answerer.handle({
      text,
      userId: msg.from.id,
      directed,
      context: msg.reply_to_message?.text,
    });
    if (!out) return;
    const send = { chat_id: chat.id, reply_parameters: { message_id: msg.message_id, allow_sending_without_reply: true } };
    if (out.draft) {
      // Old drafts expire; this one waits for its author's tap.
      for (const [id, d] of Object.entries(drafts)) if (d.created + DRAFT_TTL < now()) delete drafts[id];
      const id = answerer.draftId();
      drafts[id] = { ...out.draft, userId: msg.from.id, created: now() };
      store.save();
      const label = out.draft.kind === 'bug' ? 'bug report' : 'feature request';
      await tg.call('sendMessage', {
        ...send,
        text: `${out.reply ? `${out.reply}\n\n` : ''}Want me to open a GitHub ${label}? Draft title: "${out.draft.title}". Only the person who wrote it can tap the button.`,
        reply_markup: { inline_keyboard: [[{ text: 'Open a GitHub issue', callback_data: `i:${id}` }]] },
      });
      return;
    }
    await tg.call('sendMessage', { ...send, text: out.reply });
  }

  async function onIssueTap(q) {
    const id = q.data.slice(2);
    const d = drafts[id];
    if (!d) {
      await tg.call('answerCallbackQuery', { callback_query_id: q.id, text: 'That draft has expired.' });
      return;
    }
    if (q.from.id !== d.userId) {
      await tg.call('answerCallbackQuery', { callback_query_id: q.id, text: 'Only the person who wrote it can open this one.' });
      return;
    }
    delete drafts[id];
    store.save();
    let issue = null;
    try {
      issue = await answerer.openIssue(d);
    } catch (err) {
      log(`Opening an issue failed: ${err.message}`);
      await tg.call('answerCallbackQuery', { callback_query_id: q.id, text: "GitHub didn't take it. Please try again later." });
      return;
    }
    if (!issue) {
      await tg.call('answerCallbackQuery', { callback_query_id: q.id, text: "That's enough issues for today. Please try again tomorrow." });
      return;
    }
    await tg.call('answerCallbackQuery', { callback_query_id: q.id, text: 'Opened!' });
    await tg.call('editMessageText', {
      chat_id: q.message.chat.id,
      message_id: q.message.message_id,
      text: `${q.message.text.split('\n\nWant me to open')[0]}\n\nOpened issue #${issue.number}: ${issue.url}`,
    });
  }

  async function onUpdate(u) {
    if (u.message) return onMessage(u.message);
    if (u.callback_query) {
      const q = u.callback_query;
      if (q.data?.startsWith('i:')) return onIssueTap(q);
      if (!(await verifier.onCallback(q))) await tg.call('answerCallbackQuery', { callback_query_id: q.id });
      return;
    }
    const cm = u.chat_member;
    if (cm && ours(cm.chat)) {
      const was = cm.old_chat_member.status;
      const is = cm.new_chat_member.status;
      const inside = (s) => ['member', 'restricted', 'administrator', 'creator'].includes(s);
      if (!inside(was) && is === 'member') await verifier.onJoin(cm.new_chat_member.user);
      else if (inside(was) && !inside(is)) await verifier.onLeave(cm.new_chat_member.user);
    }
  }

  return { onUpdate };
}

module.exports = { createBot };
