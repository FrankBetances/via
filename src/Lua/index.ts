/* -------------------------------------------------------------------------- */
/*  Lúa — periférico de refuerzo (mascota física BLE). Punto de entrada único.  */
/*                                                                             */
/*  Lúa es una pieza de MOTIVACIÓN, no de clínica: reacciona a lo que ocurre en */
/*  la tableta con estados afectivos y no recibe, calcula ni devuelve nada que  */
/*  intervenga en una medida o en un juicio clínico. VIA+ funciona idénticamente*/
/*  sin ella (todo es *no-op* si no hay adaptador registrado).                  */
/*                                                                             */
/*  Diseño y justificación regulatoria: docs/design/integracion-lua.md          */
/* -------------------------------------------------------------------------- */

export {
  LUA_AFFECTS,
  LUA_CAPABILITIES_UUID,
  LUA_CAP_DISPLAY,
  LUA_CAP_MOTORS,
  LUA_CAP_RTC,
  LUA_CAP_SPEAKER,
  LUA_EXPRESSION_UUID,
  LUA_NOISE_PERMIT_MAGIC,
  LUA_NOISE_PERMIT_MAX_TTL_MS,
  LUA_NOISE_PERMIT_RENEWAL_MS,
  LUA_NOISE_PERMIT_TTL_MS,
  LUA_NOISE_PERMIT_UUID,
  LUA_PROTOCOL_VERSION,
  LUA_SERVICE_UUID,
  LUA_STATUS_FLAG_CHARGING,
  LUA_STATUS_FLAG_LOW_BATTERY,
  LUA_STATUS_UUID,
  LuaAffect,
  LuaFirmwareState,
  base64ToBytes,
  bytesToBase64,
  decodeCapabilities,
  decodeStatus,
  encodeExpression,
  encodeNoisePermit,
  encodeNoiseRevocation,
  luaCanMakeNoise,
  nextSequence,
} from './luaProtocol';
export type { LuaCapabilities, LuaStatus } from './luaProtocol';

export {
  getLuaAdapter,
  installBleLua,
  isLuaConnected,
  luaCapabilities,
  luaExpress,
  luaSendNoisePermit,
  setLuaAdapter,
} from './luaAdapter';
export type { LuaAdapter } from './luaAdapter';

export {
  NOISE_ALLOWED_ROUTES,
  createNoisePermitController,
  installNoisePermit,
  isNoiseAllowedRoute,
  isNoisePermitGranted,
  refreshNoisePermit,
  setActiveLuaRoute,
  __resetNoisePermitForTests,
} from './noisePermit';
export type { NoisePermitController, NoisePermitDeps } from './noisePermit';

export { useLua, useLuaAffectWhileMounted, useLuaDiagnostics } from './useLua';
export type { LuaControls, LuaDiagnostics } from './useLua';

export { activeRouteName, handleNavigationStateChange } from './luaRoute';

export { installLua } from './installLua';
