/* -------------------------------------------------------------------------- */
/*  Lúa — periférico físico de refuerzo. Punto de entrada único.                 */
/*                                                                             */
/*  Lúa es la mascota de Valeria+ —una gata negra en píxel art— y también un      */
/*  aparato sobre ESP32-C3 con una pantalla circular de 240×240. **El proyecto    */
/*  vive en `FrankBetances/Valeria`**: allí están el firmware, la tabla de        */
/*  opcodes (`firmware/lua/protocol.json`, fuente única del enlace) y el plan     */
/*  `docs/plan-integracion-lua.md`.                                             */
/*                                                                             */
/*  LA PARTE DE VIA+ ES DELIBERADAMENTE MÍNIMA. El §8 de ese plan se titula      */
/*  «VIA+: la integración correcta es la ausencia»: Lúa no está presente durante  */
/*  la medición —requisito de procedimiento, no de software— y lo único que hace  */
/*  VIA+ es la recompensa al cerrar la sesión, más el silencio clínico como       */
/*  defensa en profundidad. Nada de esto influye en ninguna medida ni en ningún   */
/*  informe, y sin aparato todo es *no-op*.                                     */
/*                                                                             */
/*  Diseño del lado de VIA+: docs/design/integracion-lua.md                      */
/* -------------------------------------------------------------------------- */

/* Tabla de opcodes — GENERADA desde `protocol.json`. No editar a mano. */
export {
  LUA_CAP,
  LUA_CHR,
  LUA_LIMITS,
  LUA_MODE,
  LUA_OP,
  LUA_PROTOCOL_VERSION,
  LUA_SAFE,
  LUA_SERVICE_UUID,
  luaFrame,
  luaGrantParam,
} from './luaProtocol';
export type { LuaOp } from './luaProtocol';

/* Formato de cable que la tabla no cubre, leído del firmware. */
export {
  base64ToBytes,
  bytesToBase64,
  clampGrantSeconds,
  decodeLuaState,
  isLuaProtocolCompatible,
  luaSafeFrame,
} from './luaWire';
export type { LuaState } from './luaWire';

export {
  getLuaAdapter,
  installBleLua,
  isLuaConnected,
  luaCelebrate,
  luaClinicalSilence,
  luaCtrl,
  luaGrant,
  luaHeartbeat,
  luaIdle,
  luaMute,
  luaState,
  luaUnlock,
  setLuaAdapter,
} from './luaAdapter';
export type { LuaAdapter } from './luaAdapter';

export {
  createClinicalSilenceController,
  installClinicalSilence,
  isLuaSilenced,
  __resetClinicalSilenceForTests,
} from './clinicalSilence';
export type { ClinicalSilenceController, ClinicalSilenceDeps } from './clinicalSilence';

export {
  CLOSING_CELEBRATION_INTENSITY,
  CLOSING_GRANT_SECONDS,
  createClosingReward,
  createRealClosingReward,
} from './closingReward';
export type { ClosingReward, ClosingRewardDeps } from './closingReward';

/* La mascota vive en `src/Components/Mascot/LuaPixel.tsx`, copia literal de
 * Valeria+ que NO se edita aquí (`scripts/check-lua-sprite.js` compara el dibujo
 * píxel a píxel). Se reexporta desde aquí porque el mismo sprite es la cara del
 * periférico: una pantalla que celebre el cierre pinta la misma gata que el
 * aparato, no una segunda interpretación. */
export { CAT_TUXEDO, CatPixel, catSilhouette } from '@/Components/Mascot/LuaPixel';
export type { CatPalette, CatPose } from '@/Components/Mascot/LuaPixel';

export { useLuaClosingReward, useLuaDiagnostics } from './useLua';
export type { LuaDiagnostics } from './useLua';

export { installLua } from './installLua';
