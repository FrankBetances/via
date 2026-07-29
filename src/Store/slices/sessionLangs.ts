/* -------------------------------------------------------------------------- */
/*  Registro de idiomas de la SESIÓN de evaluación (lógica PURA, sin redux).    */
/*                                                                             */
/*  Lenguas/variantes seleccionables: castellano, gallego, euskera y           */
/*  dominicano. Coincide con las lenguas que la app puede locutar              */
/*  (`VOICE_LANGS` en `src/Voice`); un test de coherencia evita que diverjan.  */
/*                                                                             */
/*  Las cuatro tienen ya banco verbal propio (`VERBAL_BANK_LANGS`): el gallego */
/*  del plan Nós (M3) y el euskera (banco propio sobre la fonología vasca);    */
/*  un test de coherencia impide que el selector ofrezca una lengua sin banco. */
/*  Aun así, la audiometría verbal SANEA el idioma que recibe                  */
/*  (`resolveVerbalLang`): un valor persistido de una versión anterior degrada */
/*  a castellano en vez de tumbar la pantalla.                                 */
/*  Módulo puro para poder testearlo sin arrastrar redux.                       */
/* -------------------------------------------------------------------------- */

export const SESSION_LANGS = ['es', 'gl', 'eu', 'es-DO'] as const;

export type SessionLang = (typeof SESSION_LANGS)[number];

/** Etiqueta de cada idioma de sesión para el selector del hub. */
export const SESSION_LANG_LABEL: Record<SessionLang, string> = {
  es: 'Español (España)',
  gl: 'Galego',
  eu: 'Euskara',
  'es-DO': 'Español (Rep. Dominicana) · Quisqueya Habla',
};
