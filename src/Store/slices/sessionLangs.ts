/* -------------------------------------------------------------------------- */
/*  Registro de idiomas de la SESIÓN de evaluación (lógica PURA, sin redux).    */
/*                                                                             */
/*  Lenguas/variantes seleccionables: castellano, gallego y dominicano.        */
/*  Coincide con las lenguas que la app puede locutar (`VOICE_LANGS` en         */
/*  `src/Voice`); un test de coherencia evita que diverjan.                     */
/*                                                                             */
/*  OJO — desacoplado de los BANCOS verbales (`VERBAL_BANK_LANGS` = es, es-DO): */
/*  elegir un idioma sin banco propio (hoy `gl`) NO rompe la audiometría        */
/*  verbal —degrada al banco español base hasta que el plan Nós (M3) registre   */
/*  el banco gallego— pero SÍ selecciona las consignas habladas gallegas        */
/*  (capa de voz). Módulo puro para poder testearlo sin arrastrar redux.        */
/* -------------------------------------------------------------------------- */

export const SESSION_LANGS = ['es', 'gl', 'es-DO'] as const;

export type SessionLang = (typeof SESSION_LANGS)[number];

/** Etiqueta de cada idioma de sesión para el selector del hub. */
export const SESSION_LANG_LABEL: Record<SessionLang, string> = {
  es: 'Español (España)',
  gl: 'Galego',
  'es-DO': 'Español (Rep. Dominicana) · Quisqueya Habla',
};
