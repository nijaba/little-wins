/**
 * Español. Mismas claves que en.js; lo que falte se completa con el inglés.
 */
module.exports = {
  pages: {
    appName: 'Little Wins',
    backToApp: 'Volver a Little Wins',
    askForPlace: 'Pedir una plaza',
    unknownProvider: 'Ese proveedor de acceso no está configurado aquí.',
    signInExpired: 'El acceso tardó demasiado o empezó en otro navegador. Inténtalo de nuevo.',
    signInUnchecked: 'No se pudo comprobar el acceso. Inténtalo de nuevo.',
    providerFailed: 'El proveedor de acceso no respondió como se esperaba. Inténtalo de nuevo.',
    emailNotVerified: 'Google no confirmó que el correo de esta cuenta esté verificado.',
    privateInstance:
      'Este Little Wins es privado. Pide a un padre de la familia un enlace de invitación y entra desde él.',
    tooManyTries: (seconds) => `Demasiados intentos. Inténtalo de nuevo en ${seconds} s.`,
  },

  demo: {
    family: 'Familia de demostración',
    parent: 'Sam (demo)',
    children: ['Mía', 'Leo'],
    message: '¡Qué bien ayudaste con la cena ayer! Estoy orgulloso de ti.',
  },

  starter: {
    targets: [
      ['Rutina de la mañana hecha', 'por rutina'],
      ['Ayudar con una tarea de la casa', 'puntos por tarea'],
      ['Ordenar el cuarto', 'por día'],
      ['Deberes 30 min', ''],
      ['Leer 20 min', ''],
      ['Palabras o gestos amables', 'por ocasión'],
      ['Practicar un instrumento o deporte 15 min', ''],
      ['Cumplir las normas de pantallas', 'por día'],
      ['Usar una estrategia para calmarse', 'cuando se enfada'],
    ],
    penalties: [
      ['Pegar o hacer daño a alguien', 'por incidente'],
      ['Palabras groseras o desagradables', 'por incidente'],
      ['Saltarse las normas de pantallas', 'por incidente'],
    ],
    challenges: ['Rutina de la mañana', 'Palabras amables', 'Deberes', 'Dormir a su hora'],
    rewards: [
      'Elegir la película familiar',
      'Elegir la cena',
      '30 min extra de pantalla',
      'Salida al parque',
      'Un libro nuevo',
      'Un día especial de paseo',
    ],
  },
};
