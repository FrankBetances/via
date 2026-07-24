/* -------------------------------------------------------------------------- */
/*  ARCHIVO GENERADO por `node scripts/build-voice-asset-map.js` — NO EDITAR.   */
/*                                                                             */
/*  Mapa estático id→módulo de asset de audio. Los `require()` son LITERALES    */
/*  (Metro no admite requires dinámicos), uno por locución con fichero real en  */
/*  `assets/voice/`. Se reescribe entero en cada corrida del pipeline; solo     */
/*  entran ids cuyo asset `.m4a` existe. Mientras esté vacío, `viaVoice.speak`  */
/*  cae siempre a la voz del sistema (sin regresión).                           */
/* -------------------------------------------------------------------------- */

/** Versión del paquete de assets (nº de locuciones + hash de sus ids). */
export const VOICE_ASSETS_VERSION = "built-5-3bc5078e";

/** id de locución → módulo del asset (`require(...)`). Poblado por el pipeline. */
export const VOICE_ASSETS: Record<string, number> = {
  "tutor_21853718_99": require('../../assets/voice/tutor_21853718_99.m4a'),
  "tutor_387fbf0e_78": require('../../assets/voice/tutor_387fbf0e_78.m4a'),
  "tutor_95399f2d_99": require('../../assets/voice/tutor_95399f2d_99.m4a'),
  "tutor_a8c07bce_104": require('../../assets/voice/tutor_a8c07bce_104.m4a'),
  "tutor_d21e608b_101": require('../../assets/voice/tutor_d21e608b_101.m4a'),
};
