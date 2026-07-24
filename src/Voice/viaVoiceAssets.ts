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
export const VOICE_ASSETS_VERSION = "unbuilt";

/** id de locución → módulo del asset (`require(...)`). Poblado por el pipeline. */
export const VOICE_ASSETS: Record<string, number> = {};
