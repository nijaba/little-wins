// Spanish strings for the page. Same keys as strings.en.js; missing keys fall back to English.
window.LW_STRINGS = window.LW_STRINGS || {};
window.LW_STRINGS.es = {
  appName: 'Little Wins',
  locale: 'es',

  // Bottom tabs: [icon, label]
  tabs: {
    today: ['☀️', 'Hoy'],
    week: ['⭐', 'Semana'],
    rew: ['🏆', 'Premios'],
    hist: ['🕘', 'Historial'],
    set: ['⚙️', 'Ajustes'],
  },

  // Header and shared bits
  header: (balance, stars) => `${balance} pts · ${stars} ★`,
  pts: 'pts',
  ptsRange: (a, b) => `${a}-${b} pts`,
  star: '★',

  // Signed-out screen, invite and setup
  login: {
    codeIOS:
      'En iPhone o iPad, añade primero Little Wins a la pantalla de inicio (Compartir ⬆️ y «Añadir a pantalla de inicio»), ábrelo desde ahí y escribe el código en la app.',
    signupTitle: 'Te han invitado a crear una familia',
    signupHelp:
      'Inicia sesión para crear tu familia en este Little Wins. La invitación funciona una sola vez.',
    signInWith: { google: 'Entrar con Google', github: 'Entrar con GitHub' },
    parentsOnly: 'Para padres',
    codeTitle: 'Usa un código de un adulto',
    codeHelp: 'En el dispositivo de un niño, escribe el código que un padre creó en Ajustes.',
    codePlaceholder: 'ABCD-EFGH-JK',
    codeButton: 'Conectar este dispositivo',
    codeFailed: 'Ese código no funcionó. Pide uno nuevo a un padre.',
    joinTitle: (family) => `Únete a ${family}`,
    joinHelp: 'Entra para unirte a esta familia como padre.',
    inviteInvalid:
      'Este enlace de invitación no funciona. Puede que haya caducado o ya se haya usado.',
    notNow: 'Ahora no',
    networkError: 'No se puede conectar con el servidor. Inténtalo de nuevo.',
    familyDeleted: 'Familia eliminada.',
  },
  // The welcome on the sign-in page
  welcome: {
    tagline: 'Celebra los pequeños logros, una estrella a la vez.',
    perks: [
      ['⭐', 'Puntos y estrellas por lo bueno'],
      ['🏆', 'Recompensas que elige toda la familia'],
      ['🌈', 'Solo buenas noticias en la pantalla de tu hijo'],
    ],
  },
  legal: { about: 'Acerca de Little Wins', privacy: 'Privacidad', terms: 'Condiciones' },
  operator: {
    dashboard: 'Abrir el panel',
    dashboardHelp: 'Más cifras y los ajustes, en un ordenador.',
    idleAfter: 'Familias inactivas eliminadas tras',
    days: (n) => `${n} días`,
    never: 'nunca',
    ofLimit: (n, max) => `${n} / ${max}`,
    familyInvites: 'Invitaciones de familias',
    familyInvitesHelp:
      'Aquí solo pueden registrarse las familias invitadas. Cada enlace funciona una vez, durante 30 días.',
    inviteFamily: 'Invitar a una familia',
    familyInviteTitle: 'Enlace de invitación',
    familyInviteHelp: 'Envía este enlace a la familia. Funciona una sola vez.',
    familyInviteExpires: 'Caduca en 30 días',
    title: 'Operador',
    help: 'Cifras de esta instalación. Aquí nunca se muestra el contenido de las familias.',
    loading: 'Cargando…',
    refresh: 'Actualizar',
    failed: 'No se pudieron cargar las cifras. Inténtalo de nuevo.',
    families: 'Familias',
    unclaimedFamilies: 'Familias sin reclamar',
    parents: 'Padres',
    children: 'Niños',
    devices: 'Dispositivos',
    activeDevices30d: 'Dispositivos activos (30 días)',
    entries: 'Registros',
    dbSize: 'Tamaño de la base de datos',
    mb: (n) => `${n} MB`,
    version: 'Versión',
    uptime: 'Tiempo activo',
    duration: (s) => {
      const d = Math.floor(s / 86400);
      const h = Math.floor((s % 86400) / 3600);
      const m = Math.floor((s % 3600) / 60);
      return d ? `${d} d ${h} h` : h ? `${h} h ${m} min` : `${m} min`;
    },
  },
  setup: {
    full: 'Este Little Wins está completo por ahora: no tiene sitio para familias nuevas.',
    askForPlace: 'Pedir una plaza',
    title: 'Configura tu familia',
    hello: (name) => `Te damos la bienvenida, ${name}.`,
    familyName: 'Nombre de la familia',
    childName: 'Nombre del primer niño',
    timeZone: 'Zona horaria',
    weekStart: 'La semana empieza el',
    monday: 'Lunes',
    sunday: 'Domingo',
    starter: 'Empezar con una lista de ejemplo de comportamientos y premios',
    language: 'Idioma',
    create: 'Crear',
    private:
      'Este Little Wins es privado. Pide a un padre de la familia un enlace de invitación y entra desde él.',
    signOut: 'Salir',
  },

  // Toast and history descriptions
  undo: 'Deshacer',
  undoLower: 'deshacer',
  note: 'Nota',
  noteLower: 'nota',
  notePrompt: 'Nota para los padres (tu hijo nunca la ve). Déjala vacía para quitarla.',
  warningPrefix: '⚠ Aviso · ',

  // Next-reward ring
  ring: {
    allUnlocked: '🎉 ¡Todo desbloqueado!',
    next: 'Próximo premio',
    pts: 'pts',
  },

  // Celebration overlay
  party: {
    unlocked: '¡Premio desbloqueado!',
  },

  // Today tab
  today: {
    soFar: (n) => `+${n} hoy, ¡genial!`,
    noneYet: 'Aún no hay puntos hoy, ¡vamos!',
    earn: 'Ganar puntos',
    waysToEarn: 'Formas de ganar puntos',
    penalties: 'Penalizaciones',
    promptPoints: (min, max) => `Puntos (${min}-${max})`,
    confirmPenalty: (name) => `¿Registrar penalización: ${name}?`,
    warnButton: (n) => `⚠${n}/2`,
  },

  // Week tab
  week: {
    wonStamp: '⭐ ¡ganada!',
    prevLabel: 'Semana anterior',
    nextLabel: 'Semana siguiente',
    thisWeek: 'Esta semana',
    weekOf: (d) => `Semana del ${d}`,
    starsWon: (n) => ` · ${n} ★ ganada${n === 1 ? '' : 's'}`,
    back: 'Volver a esta semana',
    challenges: 'Retos semanales',
    rule: 'Gana ★ con 2 o más días perfectos y ningún día malo en la semana.',
    ruleParent: ' Toca un día para marcar ✓ perfecto, ~ regular o ✗ malo.',
    won: '★ ganada',
    perfectDays: (n) => `${n}/2 días perfectos`,
    aBadDay: ' · un día malo',
    marks: { perfect: '✓', ok: '~', bad: '✗', none: '·' },
  },

  // Rewards tab
  rewards: {
    toGo: (stars, points) =>
      stars && points !== '0'
        ? `¡Faltan ${stars} ★ y ${points} puntos!`
        : stars
          ? `¡Faltan ${stars} ★!`
          : `¡Faltan ${points} puntos!`,
    yourStars: (n) => `Tus estrellas: ${n}`,
    toNext: (n, name) => `${n} ★ más para ${name}`,
    title: 'Premios',
    unlocked: '✅ desbloqueado',
    pointsPlus: (n) => `+ ${n} pts`,
  },

  egg: {
    on: '🥚 Sorpresa oculta (elegir sus emojis): activada',
    off: '🥚 Sorpresa oculta (elegir sus emojis): desactivada',
    found: '¡Encontraste el secreto! Toca un emoji para cambiarlo.',
    title: 'Elige tu emoji',
    original: 'El original',
    done: '✓ Listo',
  },
  notices: {
    on: '🔔 Avisos en su dispositivo: activados',
    off: '🔔 Avisos en su dispositivo: desactivados',
    offer:
      'Recibe un aviso en este dispositivo cuando desbloquees una recompensa o alcances un logro.',
    turnOn: 'Activar los avisos',
    paired: (name) => `Este teléfono ya es de ${name}.`,
    pairOffer:
      'Activa los avisos ahora que lo tienes en la mano: toca Activar los avisos y luego Permitir.',
    pairHint:
      '¿Avisos en su teléfono? Permítelos aquí antes de escribir el código, y el teléfono los ofrecerá en cuanto se conecte.',
    notNow: 'Ahora no',
  },
  reminder: {
    title: 'Recordatorio de la tarde',
    help: 'Un recordatorio en este teléfono para marcar los retos del día, solo si queda algo sin marcar. Pasa por el servicio de notificaciones del fabricante (Apple, Google o Mozilla), que no puede leerlo.',
    time: 'Recordármelo a las',
    turnOn: 'Recordármelo en este teléfono',
    save: 'Guardar la hora',
    off: 'Desactivar',
    on: (t) => `Activado: todos los días a las ${t}, en este teléfono.`,
    denied:
      'Las notificaciones están bloqueadas para Little Wins. Permítelas en los ajustes del teléfono o del navegador y vuelve a intentarlo.',
    unsupported:
      'Este navegador no puede mostrar recordatorios. En iPhone, añade primero Little Wins a la pantalla de inicio (Compartir, luego Añadir a pantalla de inicio) y ábrelo desde ahí.',
    failed: 'No se pudo activar el recordatorio. Inténtalo de nuevo.',
  },
  // Adding Little Wins to the home screen
  install: {
    title: '📲 Añade Little Wins a la pantalla de inicio',
    help: 'Se abre como una app: a pantalla completa, a un toque.',
    button: 'Instalar',
    notNow: 'Ahora no',
    ios: 'En iPhone o iPad: toca Compartir ⬆️ y luego «Añadir a pantalla de inicio».',
  },
  cheer: {
    from: (who) => `de ${who}`,
    write: (name) => `💬 Escribir un mensaje a ${name}`,
    change: 'Cambiar',
    clear: 'Borrar',
    prompt: (name) =>
      `Un mensaje corto para ${name} (hasta 140 caracteres). Se muestra en su pantalla Hoy durante una semana. Déjalo vacío para quitarlo.`,
    streak: (n) => `🔥 ¡${n} días perfectos seguidos!`,
    best: '🏅 ¡La mejor semana hasta ahora!',
  },
  // The child's greeting on Today, by time of day
  greet: {
    morning: (n) => `¡Buenos días, ${n}!`,
    afternoon: (n) => `¡Buenas tardes, ${n}!`,
    evening: (n) => `¡Buenas noches, ${n}!`,
  },
  // Kind words where a list is empty
  empty: {
    history: 'Todavía no hay nada. ¡El primer logro está en camino!',
    rewards: 'Aún no hay recompensas. ¡Pide a un padre que añada alguna!',
    rewardsParent: 'Aún no hay recompensas. Añade la primera en Ajustes → Recompensas.',
    challenges: 'No hay retos esta semana. ¡Disfruta de los puntos!',
    challengesParent: 'Aún no hay retos semanales. Añade uno en Ajustes → Retos semanales.',
  },
  review: {
    open: 'Resumen de la semana',
    title: (name) => `Resumen de la semana: ${name}`,
    stars: 'Estrellas ganadas',
    earned: 'Puntos ganados',
    lost: 'Puntos perdidos (penalizaciones)',
    warnings: 'Avisos',
    perfectDays: 'Días perfectos',
    badDays: 'Días malos',
    byDay: 'Puntos por día',
    challenges: 'Retos semanales',
    top: 'Lo más frecuente',
    warnedFor: 'Avisos por',
    recent: 'Las últimas 4 semanas',
    week: 'Semana del',
    times: (n) => `${n}×`,
    none: 'No se registró nada esta semana.',
    print: 'Imprimir',
    back: 'Volver a la semana',
  },
  // History tab
  history: {
    today: 'Hoy',
    yesterday: 'Ayer',
    title: 'Historial',
    warning: '⚠ aviso',
    mark: 'marca: ',
    // Challenge marks, by name
    markNames: { perfect: 'perfecto', ok: 'regular', bad: 'malo' },
  },

  // Settings tab
  settings: {
    pairIOS:
      'En un iPhone o iPad, añade primero Little Wins a su pantalla de inicio y luego escribe el código en la app.',
    fieldEmoji: 'Emoji',
    noEmoji: 'Sin emoji',
    forLabel: (names) => `Para: ${names}`,
    forNobody: 'nadie por ahora',
    forWho: '¿Para quién?',
    forHelp: 'Marca a todos los niños para que sea para todos, también los que añadas después.',
    idleNote: (days) =>
      `Una familia que ningún teléfono ni navegador usa durante ${days} días se elimina, con todos sus datos.`,
    family: 'Familia',
    familyName: 'Nombre de la familia',
    timeZone: 'Zona horaria',
    weekStart: 'La semana empieza el',
    monday: 'Lunes',
    sunday: 'Domingo',
    language: 'Idioma',
    save: 'Guardar',
    children: 'Niños',
    rename: 'Renombrar',
    addChild: '+ Añadir niño',
    confirmDeleteChild: (name) => `¿Eliminar a ${name} y todo su historial? No se puede deshacer.`,
    parents: 'Padres',
    owner: 'Titular',
    parentRole: 'Padre',
    you: 'tú',
    makeOwner: 'Hacer titular',
    removeParent: 'Quitar',
    confirmMakeOwner: (name) => `¿Hacer titular a ${name}? Tú pasarás a ser un padre normal.`,
    confirmRemoveParent: (name) => `¿Quitar a ${name} de la familia?`,
    inviteParent: 'Invitar a un padre',
    inviteTitle: 'Enlace de invitación',
    inviteHelp: 'Envía este enlace al padre. Solo funciona una vez.',
    inviteExpires: 'Caduca en 7 días',
    openInvites: 'Invitaciones abiertas',
    inviteSent: (date) => `Invitación enviada ${date}`,
    inviteUntil: (date) => `caduca ${date}`,
    cancelInvite: 'Cancelar',
    copy: 'Copiar',
    copied: 'Copiado',
    share: 'Compartir',
    done: 'Listo',
    signOut: 'Salir',
    exportData: 'Descargar todos nuestros datos',
    deleteTitle: 'Eliminar esta familia',
    deleteWarning:
      'Esto elimina todos los niños, el historial, los comportamientos, los premios y los dispositivos de toda la familia. No se puede deshacer. Descarga antes tus datos.',
    deleteType: 'Escribe el nombre de la familia para confirmar',
    deleteButton: 'Eliminar esta familia',
    confirmDeleteFamily: '¿Eliminar esta familia y todo lo que contiene? No se puede deshacer.',
    behaviors: 'Comportamientos',
    penalties: 'Penalizaciones',
    challenges: 'Retos semanales',
    rewards: 'Premios',
    devices: 'Dispositivos',
    edit: 'Editar',
    remove: '✕',
    add: '+ Añadir',
    confirmRemoveItem: '¿Quitar esto? El historial anterior se conserva.',
    confirmRemoveReward: '¿Quitar este premio?',
    up: '▲',
    down: '▼',

    // Edit form titles, by what is edited
    editTitle: {
      target: 'Editar comportamiento',
      penalty: 'Editar penalización',
      challenge: 'Editar reto',
      reward: 'Editar premio',
      child: 'Editar niño',
    },
    addTitle: {
      target: 'Añadir un comportamiento',
      penalty: 'Añadir una penalización',
      challenge: 'Añadir un reto',
      reward: 'Añadir un premio',
      child: 'Añadir un niño',
    },
    fieldName: 'Nombre',
    fieldStars: 'Estrellas necesarias',
    fieldPoints: 'Puntos necesarios',
    fieldNote: 'Nota (p. ej. por día)',
    fieldPenalty: 'Puntos perdidos',
    fieldMin: 'Puntos (mín.)',
    fieldMax: 'Puntos (máx.; igual al mín. si es fijo)',
    cancel: 'Cancelar',

    // Devices
    devicesHelp:
      'Teléfonos y navegadores con la sesión iniciada. Cierra la sesión de uno perdido o que ya no uses.',
    parentDevice: 'Padre',
    childDevice: 'Niño',
    deviceLabel: (who, device) => `${who} · ${device}`,
    addDevice: (name) => `Añadir un dispositivo para ${name}`,
    pairTitle: (name) => `Dispositivo de ${name}`,
    pairHelp: 'En el dispositivo del niño, abre el enlace o escribe este código.',
    expiresIn: (t) => `Caduca en ${t}`,
    expired: 'Caducado',
    thisDevice: 'este dispositivo',
    lastUsed: (ago) => `Último uso ${ago}`,
    loggedIn: (date) => `sesión iniciada ${date}`,
    logOut: 'Cerrar sesión',
    confirmLogOutMe: '¿Cerrar la sesión de este dispositivo? Tendrás que entrar de nuevo.',
    confirmLogOutOther:
      '¿Cerrar la sesión de ese dispositivo? Tendrá que entrar o vincularse de nuevo.',
  },

  // "Last seen" wording
  ago: {
    justNow: 'ahora mismo',
    min: (n) => `hace ${n} min`,
    hours: (n) => `hace ${n} h`,
    days: (n) => `hace ${n} días`,
  },

  // Demo families (DEMO_FAMILIES=1) and the tour video
  demo: {
    tryTitle: 'Pruébalo primero',
    tryHelp: 'Abre una familia inventada, sin iniciar sesión. Nada de lo que hagas allí se guarda.',
    tryButton: 'Probar la demo',
    videoTitle: 'Míralo en 30 segundos',
    videoHelp: 'Un breve recorrido narrado de la app.',
    watchButton: 'Ver el vídeo',
    videoLabel: 'Vídeo del recorrido',
    closeVideo: 'Cerrar',
    bannerLabel: 'Demo',
    banner: (minutes) =>
      `Familia de demo: personas y datos inventados, se borra tras ${minutes} minutos sin uso.`,
    childView: (name) => `Vista de ${name}`,
    parentView: 'Vista de los padres',
    leave: 'Salir de la demo',
    off: 'Esto es una demo: invitar a otro padre, añadir un dispositivo para un niño, cerrar la sesión de dispositivos, exportar y borrar están desactivados.',
    ended: 'La demo terminó tras un rato sin uso. Puedes empezar otra cuando quieras.',
  },

  // The guided tour: a title (t) and a sentence or two (b) per step, by role
  tour: {
    offer: '¿Eres nuevo? Un recorrido rápido te muestra lo principal.',
    offerLabel: 'Invitación al recorrido',
    take: 'Hacer el recorrido',
    noThanks: 'No, gracias',
    step: (n, total) => `Paso ${n} de ${total}`,
    back: 'Atrás',
    next: 'Siguiente',
    done: 'Listo',
    close: 'Cerrar',
    parent: {
      earn: {
        t: 'Ganar puntos',
        b: 'Toca + cuando tu hijo haga una de estas cosas. Un comportamiento con rango te pregunta cuántos puntos.',
      },
      warn: {
        t: 'Avisos',
        b: 'Un aviso es una advertencia suave, que se cuenta por día (1/2). No cuesta puntos.',
      },
      penalties: {
        t: 'Penalizaciones',
        b: 'Una penalización quita puntos cuando la confirmas. El saldo nunca baja de cero y los niños nunca ven las penalizaciones.',
      },
      marks: {
        t: 'Retos semanales',
        b: 'Toca un día para marcarlo perfecto, regular o malo. Dos días perfectos y ningún día malo ganan una estrella en la semana.',
      },
      rewards: {
        t: 'Premios',
        b: 'Los premios se desbloquean con estrellas y puntos. El anillo muestra lo cerca que está el siguiente; no se gasta nada.',
      },
      history: {
        t: 'Historial y deshacer',
        b: 'Todo lo registrado, lo más reciente primero. Deshacer corrige un error y el saldo se calcula de nuevo.',
      },
      settings: {
        t: 'Ajustes',
        b: 'Cambia comportamientos, penalizaciones, retos y premios, añade niños e invita a otro padre.',
      },
      device: {
        t: 'El móvil de tu hijo',
        b: 'En Dispositivos, añade un dispositivo para obtener un código de un solo uso para el móvil de tu hijo. Solo muestra su progreso: sin penalizaciones, avisos ni notas.',
      },
    },
    child: {
      header: {
        t: 'Tus puntos y estrellas',
        b: 'Tus puntos y estrellas siempre están arriba del todo.',
      },
      ring: {
        t: 'Tu próximo premio',
        b: 'El anillo muestra lo cerca que estás de tu próximo premio.',
      },
      earn: {
        t: 'Formas de ganar',
        b: 'Con esto ganas puntos. Un padre los añade cuando lo haces.',
      },
      marks: {
        t: 'Esta semana',
        b: 'Tus retos, día a día. Dos días perfectos y ningún día malo ganan una estrella.',
      },
      rewards: { t: 'Premios', b: 'Cada premio y lo que necesita. ¡Sigue así!' },
    },
  },

  // Errors from the server, by the `code` it sends. Functions get the reply's extra fields.
  errors: {
    serviceFull: 'Este Little Wins está completo por ahora: no tiene sitio para familias nuevas.',
    login: 'Entra de nuevo, por favor.',
    viewOnly: 'Este dispositivo solo puede mirar, no cambiar nada.',
    badRequest: 'No funcionó. Inténtalo de nuevo.',
    notFound: 'Eso ya no está aquí. Puede que se haya quitado desde otro dispositivo.',
    tooLarge: 'Es demasiado largo.',
    jsonOnly: 'No funcionó. Recarga la página e inténtalo de nuevo.',
    foreignOrigin: 'Se rechazó una petición de otro sitio.',
    serverError: 'Algo salió mal en el servidor. Inténtalo de nuevo.',
    nameRequired: 'Hace falta un nombre.',
    invalidDay: 'Ese día no es válido.',
    invalidTimeZone: 'Zona horaria desconocida.',
    invalidLanguage: 'Idioma desconocido.',
    setupDone: 'Esta cuenta ya tiene una familia.',
    setupNotAllowed: 'Termina primero de entrar.',
    privateInstance:
      'Este Little Wins es privado. Pide a un padre de la familia un enlace de invitación y entra desde él.',
    lastChild: 'Una familia necesita al menos un niño.',
    ownerOnly: 'Solo el titular puede hacer eso.',
    notYourself: 'No puedes hacerte eso a ti mismo.',
    codeInvalid:
      'Ese código no funciona. Puede que haya caducado o ya se haya usado. Pide uno nuevo a un padre.',
    limitReached: ({ limit }) =>
      `Esta familia ha alcanzado su límite de ${
        {
          children: 'niños',
          parents: 'padres',
          items: 'comportamientos, penalizaciones y retos',
          rewards: 'premios',
          devices: 'dispositivos',
          entriesPerDay: 'registros de hoy',
        }[limit] || limit
      }.`,
    confirmFamilyName: 'Escribe el nombre de la familia tal cual para confirmar.',
    operatorOnly: 'Solo los operadores pueden ver esto.',
    inviteInvalid:
      'Este enlace de invitación no funciona. Puede que haya caducado o ya se haya usado.',
    tooManyTries: ({ seconds }) => `Demasiados intentos. Inténtalo de nuevo en ${seconds} s.`,
    demoOff: 'Eso no está disponible en la demo.',
    demoEnded: 'La demo terminó tras un rato sin uso. Puedes empezar otra cuando quieras.',
    demoFull:
      'Todas las familias de demo están ocupadas ahora mismo. Tómate un té y vuelve a intentarlo en unos minutos.',
  },
};
