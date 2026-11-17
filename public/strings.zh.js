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
    signupTitle: '你受邀创建一个家庭',
    signupHelp: '登录以在此 Little Wins 上创建你的家庭。邀请只能使用一次。',
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
  // The welcome on the sign-in page
  welcome: {
    tagline: '一颗星一颗星，庆祝每一个小进步。',
    perks: [
      ['⭐', '为好表现赢得积分和星星'],
      ['🏆', '全家一起挑选奖励'],
      ['🌈', '孩子的屏幕上只有好消息'],
    ],
  },
  legal: { about: '关于 Little Wins', privacy: '隐私', terms: '条款' },
  operator: {
    idleAfter: '闲置家庭删除时间',
    days: (n) => `${n} 天后`,
    never: '从不',
    ofLimit: (n, max) => `${n} / ${max}`,
    familyInvites: '家庭邀请',
    familyInvitesHelp: '只有受邀的家庭才能在此注册。每个链接只能使用一次，有效期 30 天。',
    inviteFamily: '邀请一个家庭',
    familyInviteTitle: '家庭邀请链接',
    familyInviteHelp: '把这个链接发给对方家庭。只能使用一次。',
    familyInviteExpires: '30 天后过期',
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
    full: '此 Little Wins 暂时已满：没有新家庭的名额。',
    askForPlace: '申请名额',
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
  note: '备注',
  noteLower: '备注',
  notePrompt: '家长备注（孩子永远看不到）。留空即可删除。',
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
    soFar: (n) => `今天已得 +${n}，真棒！`,
    noneYet: '今天还没有积分，加油！',
    earn: '赚积分',
    waysToEarn: '赚积分的方法',
    penalties: '扣分',
    promptPoints: (min, max) => `积分（${min}-${max}）`,
    confirmPenalty: (name) => `记录扣分：${name}？`,
    warnButton: (n) => `⚠${n}/2`,
  },

  // Week tab
  week: {
    wonStamp: '⭐ 赢了！',
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
    toGo: (stars, points) =>
      stars && points !== '0'
        ? `还差 ${stars} ★ 和 ${points} 积分！`
        : stars
          ? `还差 ${stars} ★！`
          : `还差 ${points} 积分！`,
    yourStars: (n) => `你的星星：${n}`,
    toNext: (n, name) => `再得 ${n} 颗 ★ 就能换${name}`,
    title: '奖励',
    unlocked: '✅ 已解锁',
    pointsPlus: (n) => `+ ${n} 分`,
  },

  notices: {
    on: '🔔 孩子设备上的通知：开',
    off: '🔔 孩子设备上的通知：关',
    offer: '解锁奖励或达到里程碑时，在这台设备上收到通知。',
    turnOn: '开启通知',
  },
  reminder: {
    title: '晚间提醒',
    help: '在这部手机上提醒你记录今天的挑战，只有还有未记录的内容时才会发送。提醒经由手机厂商的推送服务（Apple、Google 或 Mozilla）发送，它们无法读取内容。',
    time: '提醒时间',
    turnOn: '在这部手机上提醒我',
    save: '保存时间',
    off: '关闭',
    on: (t) => `已开启：每天 ${t}，在这部手机上。`,
    denied: 'Little Wins 的通知已被阻止。请在手机或浏览器设置中允许通知，然后重试。',
    unsupported:
      '此浏览器无法显示提醒。在 iPhone 上，请先把 Little Wins 添加到主屏幕（分享 → 添加到主屏幕），再从主屏幕打开。',
    failed: '无法开启提醒，请重试。',
  },
  cheer: {
    from: (who) => `来自 ${who}`,
    write: (name) => `💬 给${name}写一句话`,
    change: '修改',
    clear: '清除',
    prompt: (name) =>
      `给${name}的一句话（最多 140 个字符），会在“今天”页面显示一周。留空即可删除。`,
    streak: (n) => `🔥 连续 ${n} 天完美！`,
    best: '🏅 目前最好的一周！',
  },
  // The child's greeting on Today, by time of day
  greet: {
    morning: (n) => `早上好，${n}！`,
    afternoon: (n) => `下午好，${n}！`,
    evening: (n) => `晚上好，${n}！`,
  },
  // Kind words where a list is empty
  empty: {
    history: '这里还没有记录，第一个小进步就要来了！',
    rewards: '还没有奖励，请家长添加吧！',
    rewardsParent: '还没有奖励，在 设置 → 奖励 中添加第一个。',
    challenges: '本周没有挑战，好好享受积分吧！',
    challengesParent: '还没有每周挑战，在 设置 → 每周挑战 中添加一个。',
  },
  review: {
    open: '本周回顾',
    title: (name) => `本周回顾：${name}`,
    stars: '获得的星星',
    earned: '获得的积分',
    lost: '扣除的积分（惩罚）',
    warnings: '警告',
    perfectDays: '完美的天数',
    badDays: '糟糕的天数',
    byDay: '每天的积分',
    challenges: '每周挑战',
    top: '最常完成',
    warnedFor: '警告事项',
    recent: '最近 4 周',
    week: '周起始',
    times: (n) => `${n} 次`,
    none: '本周没有任何记录。',
    print: '打印',
    back: '返回本周',
  },
  // History tab
  history: {
    today: '今天',
    yesterday: '昨天',
    title: '记录',
    warning: '⚠ 警告',
    mark: '标记：',
    // Challenge marks, by name
    markNames: { perfect: '完美', ok: '还行', bad: '糟糕' },
  },

  // Settings tab
  settings: {
    fieldEmoji: '表情',
    noEmoji: '不用表情',
    forLabel: (names) => `适用：${names}`,
    forNobody: '暂无',
    forWho: '适用于谁？',
    forHelp: '全部勾选即适用于所有孩子，包括以后添加的孩子。',
    idleNote: (days) =>
      `如果 ${days} 天内没有任何手机或浏览器使用某个家庭，该家庭及其所有数据将被删除。`,
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

  // Demo families (DEMO_FAMILIES=1) and the tour video
  demo: {
    tryTitle: '先试试看',
    tryHelp: '打开一个虚构的家庭，无需登录。你在里面做的一切都不会保存。',
    tryButton: '试用演示',
    videoTitle: '30 秒看懂',
    videoHelp: '一段简短的语音导览。',
    watchButton: '观看视频',
    videoLabel: '导览视频',
    closeVideo: '关闭',
    bannerLabel: '演示',
    banner: (minutes) => `演示家庭：虚构的人物和数据，闲置 ${minutes} 分钟后删除。`,
    childView: (name) => `${name}的视图`,
    parentView: '家长视图',
    leave: '退出演示',
    off: '这是演示：邀请另一位家长、为孩子添加设备、让设备退出登录、导出和删除都已关闭。',
    ended: '演示因闲置一段时间已结束。随时可以重新开始。',
  },

  // The guided tour: a title (t) and a sentence or two (b) per step, by role
  tour: {
    offer: '第一次使用？快速导览带你认识主要功能。',
    offerLabel: '导览邀请',
    take: '开始导览',
    noThanks: '不用了',
    step: (n, total) => `第 ${n} 步，共 ${total} 步`,
    back: '上一步',
    next: '下一步',
    done: '完成',
    close: '关闭',
    parent: {
      earn: {
        t: '赚积分',
        b: '孩子做到其中一项时，点 +。带范围的行为会问你给多少积分。',
      },
      warn: {
        t: '警告',
        b: '警告是一次温和的提醒，按天计数（1/2），不扣积分。',
      },
      penalties: {
        t: '扣分',
        b: '确认后，扣分会减少积分。余额不会低于零，孩子也看不到扣分。',
      },
      marks: {
        t: '每周挑战',
        b: '点一下某天，可标为完美、还行或糟糕。有 2 天完美且没有糟糕的一天，就能赢得本周的一颗星。',
      },
      rewards: {
        t: '奖励',
        b: '奖励凭星星和积分解锁。圆环显示离下一个奖励还有多近，不会花掉任何积分。',
      },
      history: {
        t: '记录和撤销',
        b: '所有记录按时间从新到旧排列。撤销可以纠正错误，余额会重新计算。',
      },
      settings: {
        t: '设置',
        b: '修改行为、扣分、挑战和奖励，添加孩子，邀请另一位家长。',
      },
      device: {
        t: '孩子的手机',
        b: '在设备里添加设备，可得到给孩子手机用的一次性代码。孩子只能看到自己的进度：没有扣分、警告或备注。',
      },
    },
    child: {
      header: { t: '你的积分和星星', b: '你的积分和星星一直在最上面。' },
      ring: { t: '你的下一个奖励', b: '圆环显示你离下一个奖励还有多近。' },
      earn: {
        t: '赚积分的方法',
        b: '做到这些就能赚积分。你做到时，由家长帮你加上。',
      },
      marks: {
        t: '本周',
        b: '你每天的挑战。有 2 天完美且没有糟糕的一天，就能赢得一颗星。',
      },
      rewards: { t: '奖励', b: '每个奖励和它的条件。继续加油！' },
    },
  },

  // Errors from the server, by the `code` it sends. Functions get the reply's extra fields.
  errors: {
    serviceFull: '此 Little Wins 暂时已满：没有新家庭的名额。',
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
    demoOff: '这在演示中不可用。',
    demoEnded: '演示因闲置一段时间已结束。随时可以重新开始。',
    demoFull: '现在所有演示家庭都在使用中。先喝杯茶，几分钟后再试。',
  },
};
