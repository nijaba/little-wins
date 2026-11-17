/**
 * 简体中文。与 en.js 的键相同；缺少的键会回退到英文。
 * 积分和星星在所有语言中数值相同，翻译只改名称和备注，顺序不变。
 */
module.exports = {
  pages: {
    appName: 'Little Wins',
    backToApp: '返回 Little Wins',
    askForPlace: '申请名额',
    unknownProvider: '这里没有设置该登录方式。',
    signInExpired: '登录超时，或是在另一个浏览器中开始的。请再试一次。',
    signInUnchecked: '无法验证登录。请再试一次。',
    providerFailed: '登录服务没有返回预期的结果。请再试一次。',
    emailNotVerified: 'Google 没有确认该账号的邮箱已通过验证。',
    privateInstance: '这个 Little Wins 是私人的。请向家人索取邀请链接，然后通过链接登录。',
    tooManyTries: (seconds) => `尝试次数太多，请 ${seconds} 秒后再试。`,
  },

  // Notices on a child's device (server/notices.js): good news only.
  notice: {
    reward: (name) => `⭐ 你解锁了${name}！`,
    streak: (n) => `🔥 连续 ${n} 天完美！`,
    best: '🏅 你目前最好的一周！',
  },
  // The evening reminder (server/reminders.js), as the phone shows it.
  reminder: { title: 'Little Wins', body: '该记录今天的挑战啦。' },

  demo: {
    family: '演示家庭',
    parent: 'Sam（演示）',
    children: ['米娅', '小乐'],
    message: '昨天你帮忙准备晚饭，做得真棒，我为你骄傲！',
  },

  starter: {
    targets: [
      ['完成早晨例行事项', '每次'],
      ['帮忙做家务', '每件家务的积分'],
      ['整理房间', '每天'],
      ['写作业 30 分钟', ''],
      ['阅读 20 分钟', ''],
      ['说好话或做暖心的事', '每次'],
      ['练习乐器或运动 15 分钟', ''],
      ['遵守看屏幕的规定', '每天'],
      ['用方法让自己平静下来', '难过时'],
    ],
    penalties: [
      ['打人或伤害别人', '每次'],
      ['说难听或没礼貌的话', '每次'],
      ['违反看屏幕的规定', '每次'],
    ],
    challenges: ['早晨例行事项', '说好话', '写作业', '准时睡觉'],
    rewards: ['选家庭电影', '选晚餐', '多看 30 分钟屏幕', '去公园玩', '一本新书', '特别的出游日'],
  },
};
