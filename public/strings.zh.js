// Simplified Chinese strings for the page. Same keys as strings.en.js; missing keys fall back to English.
window.LW_STRINGS = window.LW_STRINGS || {};
window.LW_STRINGS.zh = {
  appName: 'Little Wins',
  // BCP 47 locale for dates and numbers (Intl).
  locale: 'zh-CN',

  // Bottom tabs: [icon, label]
  tabs: {
    today: ['☀️', '今天'],
    week: ['⭐', '本周'],
    rew: ['🏆', '奖励'],
    hist: ['🕘', '记录'],
    set: ['⚙️', '设置'],
  },

  // Header and shared bits
  header: (balance, stars) => `${balance} 分 · ${stars} ★`,
  pts: '分',
  ptsRange: (a, b) => `${a}-${b} 分`,
  star: '★',

  // Signed-out screen, invite and setup
  login: {
    signInWith: { google: '使用 Google 登录', github: '使用 GitHub 登录' },
    parentsOnly: '家长登录',
    codeTitle: '使用家长给的代码',
    codeHelp: '在孩子的设备上，输入家长在“设置”里生成的代码。',
    codePlaceholder: 'ABCD-EFGH-JK',
    codeButton: '连接这台设备',
    codeFailed: '这个代码不能用。请向家长要一个新的。',
    joinTitle: (family) => `加入${family}`,
    joinHelp: '登录后即可以家长身份加入这个家庭。',
    inviteInvalid: '这个邀请链接不能用，可能已过期或已被使用。',
    notNow: '暂不',
    networkError: '无法连接服务器，请再试一次。',
    familyDeleted: '家庭已删除。',
  },
  legal: { privacy: '隐私', terms: '条款' },
  operator: {
    title: '运营',
    help: '这里只显示本站的统计数字，不会显示任何家庭的内容。',
    loading: '加载中…',
    refresh: '刷新',
    failed: '无法加载数据，请再试一次。',
    families: '家庭',
    unclaimedFamilies: '未认领的家庭',
    parents: '家长',
    children: '孩子',
    devices: '设备',
    activeDevices30d: '活跃设备（30 天）',
    entries: '记录条数',
    dbSize: '数据库大小',
    mb: (n) => `${n} MB`,
    version: '版本',
    uptime: '运行时间',
    duration: (s) => {
      const d = Math.floor(s / 86400);
      const h = Math.floor((s % 86400) / 3600);
      const m = Math.floor((s % 3600) / 60);
      return d ? `${d} 天 ${h} 小时` : h ? `${h} 小时 ${m} 分钟` : `${m} 分钟`;
    },
  },
  setup: {
    title: '设置你的家庭',
    hello: (name) => `欢迎，${name}。`,
    familyName: '家庭名称',
    childName: '第一个孩子的名字',
    timeZone: '时区',
    weekStart: '每周从哪天开始',
    monday: '周一',
    sunday: '周日',
    starter: '先用一份示例行为和奖励清单',
    language: '语言',
    create: '创建',
    private: '这个 Little Wins 是私人的。请向家人索取邀请链接，然后通过链接登录。',
    signOut: '退出登录',
  },

  // Toast and history descriptions
  undo: '撤销',
  undoLower: '撤销',
  warningPrefix: '⚠ 警告 · ',

  // Next-reward ring
  ring: {
    allUnlocked: '🎉 全部解锁啦！',
    next: '下一个奖励',
    pts: '分',
  },

  // Celebration overlay
  party: {
    unlocked: '奖励解锁啦！',
  },

  // Today tab
  today: {
    earn: '赚积分',
    waysToEarn: '赚积分的方法',
    penalties: '扣分',
    promptPoints: (min, max) => `积分（${min}-${max}）`,
    confirmPenalty: (name) => `记录扣分：${name}？`,
    warnButton: (n) => `⚠${n}/2`,
  },

  // Week tab
  week: {
    prevLabel: '上一周',
    nextLabel: '下一周',
    thisWeek: '本周',
    weekOf: (d) => `${d}那一周`,
    starsWon: (n) => ` · 赢得 ${n} ★`,
    back: '回到本周',
    challenges: '每周挑战',
    rule: '一周内有 2 天以上表现完美、且没有糟糕的一天，就能赢得 ★。',
    ruleParent: ' 点一下某天，可设为 ✓ 完美、~ 还行或 ✗ 糟糕。',
    won: '★ 已赢得',
    perfectDays: (n) => `${n}/2 个完美日`,
    aBadDay: ' · 有糟糕的一天',
    marks: { perfect: '✓', ok: '~', bad: '✗', none: '·' },
  },

  // Rewards tab
  rewards: {
    title: '奖励',
    unlocked: '✅ 已解锁',
    pointsPlus: (n) => `+ ${n} 分`,
  },

  // History tab
  history: {
    title: '记录',
    warning: '⚠ 警告',
    mark: '标记：',
    // Challenge marks, by name
    markNames: { perfect: '完美', ok: '还行', bad: '糟糕' },
  },

  // Settings tab
  settings: {
    family: '家庭',
    familyName: '家庭名称',
    timeZone: '时区',
    weekStart: '每周从哪天开始',
    monday: '周一',
    sunday: '周日',
    language: '语言',
    save: '保存',
    children: '孩子',
    rename: '改名',
    addChild: '+ 添加孩子',
    confirmDeleteChild: (name) => `删除${name}及其所有记录？此操作无法撤销。`,
    parents: '家长',
    owner: '所有者',
    parentRole: '家长',
    you: '你',
    makeOwner: '设为所有者',
    removeParent: '移除',
    confirmMakeOwner: (name) => `把${name}设为所有者？你将成为普通家长。`,
    confirmRemoveParent: (name) => `把${name}移出这个家庭？`,
    inviteParent: '邀请家长',
    inviteTitle: '邀请链接',
    inviteHelp: '把这个链接发给家长。链接只能使用一次。',
    inviteExpires: '7 天后过期',
    openInvites: '未使用的邀请',
    inviteSent: (date) => `邀请发送于 ${date}`,
    inviteUntil: (date) => `${date}过期`,
    cancelInvite: '取消',
    copy: '复制',
    copied: '已复制',
    share: '分享',
    done: '完成',
    signOut: '退出登录',
    exportData: '下载我们的全部数据',
    deleteTitle: '删除这个家庭',
    deleteWarning:
      '这会删除家庭中所有孩子、记录、行为、奖励和设备，对每位家庭成员都生效，且无法撤销。请先下载你的数据。',
    deleteType: '输入家庭名称以确认',
    deleteButton: '删除这个家庭',
    confirmDeleteFamily: '删除这个家庭及其全部内容？此操作无法撤销。',
    behaviors: '行为',
    penalties: '扣分',
    challenges: '每周挑战',
    rewards: '奖励',
    devices: '设备',
    edit: '编辑',
    remove: '✕',
    add: '+ 添加',
    confirmRemoveItem: '要移除吗？过去的记录会保留。',
    confirmRemoveReward: '要移除这个奖励吗？',
    up: '▲',
    down: '▼',

    // Edit form titles, by what is edited
    editTitle: {
      target: '编辑行为',
      penalty: '编辑扣分',
      challenge: '编辑挑战',
      reward: '编辑奖励',
      child: '编辑孩子',
    },
    addTitle: {
      target: '添加行为',
      penalty: '添加扣分',
      challenge: '添加挑战',
      reward: '添加奖励',
      child: '添加孩子',
    },
    fieldName: '名称',
    fieldStars: '所需星星',
    fieldPoints: '所需积分',
    fieldNote: '备注（如：每天）',
    fieldPenalty: '扣除积分',
    fieldMin: '积分（最少）',
    fieldMax: '积分（最多；固定则与最少相同）',
    cancel: '取消',

    // Devices
    devicesHelp: '已登录的手机和浏览器。丢失或不再使用的设备，可以让它退出登录。',
    parentDevice: '家长',
    childDevice: '孩子',
    deviceLabel: (who, device) => `${who} · ${device}`,
    addDevice: (name) => `为${name}添加设备`,
    pairTitle: (name) => `${name}的设备`,
    pairHelp: '在孩子的设备上，打开链接或输入这个代码。',
    expiresIn: (t) => `${t}后过期`,
    expired: '已过期',
    thisDevice: '本设备',
    lastUsed: (ago) => `最近使用：${ago}`,
    loggedIn: (date) => `登录于 ${date}`,
    logOut: '退出登录',
    confirmLogOutMe: '让这台设备退出登录？你需要重新登录。',
    confirmLogOutOther: '让那台设备退出登录？它需要重新登录或配对。',
  },

  // "Last seen" wording
  ago: {
    justNow: '刚刚',
    min: (n) => `${n} 分钟前`,
    hours: (n) => `${n} 小时前`,
    days: (n) => `${n} 天前`,
  },

  // Errors from the server, by the `code` it sends. Functions get the reply's extra fields.
  errors: {
    login: '请重新登录。',
    viewOnly: '这台设备只能查看，不能修改。',
    badRequest: '没有成功，请再试一次。',
    notFound: '这项内容已经不在了，可能在另一台设备上被移除了。',
    tooLarge: '内容太长了。',
    jsonOnly: '没有成功。请刷新页面后再试。',
    foreignOrigin: '已拒绝来自其他网站的请求。',
    serverError: '服务器出了点问题，请再试一次。',
    nameRequired: '请输入名称。',
    invalidDay: '这一天无效。',
    invalidTimeZone: '未知的时区。',
    invalidLanguage: '未知的语言。',
    setupDone: '这个账号已经有家庭了。',
    setupNotAllowed: '请先完成登录。',
    privateInstance: '这个 Little Wins 是私人的。请向家人索取邀请链接，然后通过链接登录。',
    lastChild: '一个家庭至少要有一个孩子。',
    ownerOnly: '只有所有者才能这样做。',
    notYourself: '不能对自己这样做。',
    codeInvalid: '这个代码不能用，可能已过期或已被使用。请向家长要一个新的。',
    limitReached: ({ limit }) =>
      `这个家庭的${
        {
          children: '孩子数量',
          parents: '家长数量',
          items: '行为、扣分和挑战数量',
          rewards: '奖励数量',
          devices: '设备数量',
          entriesPerDay: '今日记录条数',
        }[limit] || limit
      }已达上限。`,
    confirmFamilyName: '请准确输入家庭名称以确认。',
    operatorOnly: '只有运营人员才能查看。',
    inviteInvalid: '这个邀请链接不能用，可能已过期或已被使用。',
    tooManyTries: ({ seconds }) => `尝试次数太多，请 ${seconds} 秒后再试。`,
  },
};
