// Every user-facing string of the page, in one place so it can be translated later.
// Entries that depend on a value are functions; the caller escapes user-entered text.
window.STRINGS = {
  appName: 'Little Wins',

  // Bottom tabs: [icon, label]
  tabs: {
    today: ['☀️', 'Today'],
    week: ['⭐', 'Week'],
    rew: ['🏆', 'Rewards'],
    hist: ['🕘', 'History'],
    set: ['⚙️', 'Settings'],
  },

  // Header and shared bits
  header: (balance, stars) => `${balance} pts · ${stars} ★`,
  pts: 'pts',
  ptsRange: (a, b) => `${a}-${b} pts`,
  star: '★',

  // Login
  login: {
    pinPlaceholder: 'PIN',
    enter: 'Enter',
    wrongPin: 'Wrong PIN',
  },

  // Toast and history descriptions
  undo: 'Undo',
  undoLower: 'undo',
  warningPrefix: '⚠ Warning · ',

  // Next-reward ring
  ring: {
    allUnlocked: '🎉 Everything unlocked!',
    next: 'Next reward',
    pts: 'pts',
  },

  // Celebration overlay
  party: {
    unlocked: 'Reward unlocked!',
  },

  // Today tab
  today: {
    earn: 'Earn points',
    waysToEarn: 'Ways to earn points',
    penalties: 'Penalties',
    promptPoints: (min, max) => `Points (${min}-${max})`,
    confirmPenalty: (name) => `Record penalty: ${name}?`,
    warnButton: (n) => `⚠${n}/2`,
  },

  // Week tab
  week: {
    prevLabel: 'Previous week',
    nextLabel: 'Next week',
    thisWeek: 'This week',
    weekOf: (d) => `Week of ${d}`,
    starsWon: (n) => ` · ${n} ★ won`,
    back: 'Back to this week',
    challenges: 'Weekly challenges',
    rule: 'Win ★ with 2+ perfect days and no bad days in the week.',
    ruleParent: ' Tap a day to set ✓ perfect, ~ ok or ✗ bad.',
    won: '★ won',
    perfectDays: (n) => `${n}/2 perfect days`,
    aBadDay: ' · a bad day',
    marks: { perfect: '✓', ok: '~', bad: '✗', none: '·' },
  },

  // Rewards tab
  rewards: {
    title: 'Rewards',
    unlocked: '✅ unlocked',
    pointsPlus: (n) => `+ ${n} pts`,
  },

  // History tab
  history: {
    title: 'History',
    warning: '⚠ warning',
    mark: 'mark: ',
  },

  // Settings tab
  settings: {
    child: 'Child',
    notSet: 'not set',
    nameLabel: 'Name, shown in the app',
    namePlaceholder: "Your child's first name",
    save: 'Save',
    behaviors: 'Behaviors',
    penalties: 'Penalties',
    challenges: 'Weekly challenges',
    rewards: 'Rewards',
    devices: 'Devices',
    edit: 'Edit',
    remove: '✕',
    add: '+ Add',
    confirmRemoveItem: 'Remove this? Past history is kept.',
    confirmRemoveReward: 'Remove this reward?',
    up: '▲',
    down: '▼',

    // Edit form
    formEdit: 'Edit',
    formAdd: 'Add',
    reward: 'reward',
    fieldName: 'Name',
    fieldStars: 'Stars needed',
    fieldPoints: 'Points needed',
    fieldNote: 'Note (e.g. per day)',
    fieldPenalty: 'Points lost',
    fieldMin: 'Points (min)',
    fieldMax: 'Points (max; same as min if fixed)',
    cancel: 'Cancel',

    // Devices
    devicesHelp:
      'Phones and browsers that are logged in. Log out one that is lost or no longer used.',
    parent: 'Parent',
    childFallback: 'Child',
    thisDevice: 'this device',
    lastUsed: (ago) => `Last used ${ago}`,
    loggedIn: (date) => `logged in ${date}`,
    logOut: 'Log out',
    confirmLogOutMe: 'Log out this device? You will need the PIN again.',
    confirmLogOutOther: 'Log out that device? It will need the PIN again.',
  },

  // "Last seen" wording
  ago: {
    justNow: 'just now',
    min: (n) => `${n} min ago`,
    hours: (n) => `${n} h ago`,
    days: (n) => `${n} days ago`,
  },
};
