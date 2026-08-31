/* eslint-disable no-bitwise -- la trama de Lúa se define A NIVEL DE BYTE: los
 * enmascarados y desplazamientos de este fichero SON el formato del cable, no
 * una optimización. Reescribirlos con aritmética decimal ocultaría el
 * contrato que el firmware espera. */
/* -------------------------------------------------------------------------- */
/*  Lúa — lo que el enlace necesita y la tabla generada no trae.                */
/*                                                                             */
/*  `luaProtocol.ts` está GENERADO desde `protocol.json` y trae la tabla de     */
/*  opcodes, los UUID y la trama de `CTRL`. Falta el resto del formato de cable: */
/*  la trama de `SAFE` y el desglose de `STATE`. Eso no está en el `.json`, así  */
/*  que aquí no se deduce del documento: se lee del FIRMWARE, que es quien       */
/*  decide de verdad qué significa cada byte, y se cita la línea.                */
/*                                                                             */
/*  Fuente: `FrankBetances/Valeria` · `firmware/lua/src/main.cpp`, commit        */
/*  `0715146`. Si cambia el firmware, este fichero se revisa contra él.          */
/*                                                                             */
/*  Este es exactamente el sitio donde la primera versión de este módulo se      */
/*  equivocó: inventó una trama de permiso con TTL en décimas de segundo y un    */
/*  estado con byte de batería. Ni una cosa ni la otra existen en el aparato.    */
/* -------------------------------------------------------------------------- */

import { LUA_PROTOCOL_VERSION, LUA_LIMITS } from './luaProtocol';

/* -------------------------------------------------------------------------- */
/*  SAFE — silencio clínico y desbloqueo                                       */
/* -------------------------------------------------------------------------- */

/**
 * Trama de `SAFE`. El byte 0 es la operación **y no hay byte de versión**:
 * `main.cpp:164-165` lee `v[0]` directamente y solo comprueba que la escritura no
 * esté vacía. El `protocol.json` declara 2 bytes para la característica, así que
 * se envía el segundo a cero —reservado— en vez de una escritura de 1 byte: el
 * firmware actual ignora lo que sobra, y una implementación que validara el ancho
 * declarado también la aceptaría.
 *
 * `SAFE` se escribe **con confirmación** (`props: "write"`), al contrario que
 * `CTRL`. Es la única escritura del enlace en la que importa saber que llegó.
 */
export const luaSafeFrame = (safeOp: number): number[] => [safeOp & 0xff, 0x00];

/* -------------------------------------------------------------------------- */
/*  CTRL — concesiones                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Recorta un TTL de concesión al rango que admite el aparato. `GRANT` lleva el
 * TTL **en segundos** en el parámetro de 16 bits, y el firmware lo limita a
 * `grantMaxSeconds` (`main.cpp:127`). Se recorta también aquí para que lo que
 * viaja y lo que se cree que viaja sean lo mismo.
 */
export const clampGrantSeconds = (seconds: number): number => {
  if (!Number.isFinite(seconds)) return 1;
  return Math.max(1, Math.min(LUA_LIMITS.grantMaxSeconds, Math.round(seconds)));
};

/* -------------------------------------------------------------------------- */
/*  STATE — 8 bytes, y ninguno es la batería                                   */
/* -------------------------------------------------------------------------- */

/**
 * Estado que publica el aparato por `STATE` (`main.cpp:91-106`):
 *
 * ```
 *  [0] modo (LUA_MODE)
 *  [1] segundos de concesión restantes, recortado a 255
 *  [2] «cara»: el último opcode dibujado
 *  [3] versión de protocolo del firmware
 *  [4] fps, recortado a 255
 *  [5..7] microsegundos de despacho, 24 bits little-endian
 * ```
 *
 * **Aviso de discrepancia con la documentación de origen:** la nota de `STATE` en
 * `protocol.json` dice «modo, capacidad viva, segundos de concesión restantes,
 * batería, versión de firmware». El firmware no publica batería ni capacidades:
 * publica cara, fps y tiempo de despacho. Este códec sigue al FIRMWARE. Conviene
 * que Valeria+ corrija la nota o el firmware, pero se decide allí, no aquí.
 */
export interface LuaState {
  /** `LUA_MODE.REST` · `ACTIVE` · `LOCKED`. REST es el estado seguro. */
  mode: number;
  /** Segundos que le quedan a la concesión viva; 0 si no hay ninguna. */
  grantSecondsLeft: number;
  /** Último opcode dibujado por el aparato. Diagnóstico, no se interpreta. */
  face: number;
  /** Versión de protocolo que dice hablar el firmware. */
  protocolVersion: number;
  /** Fotogramas por segundo medidos por el aparato. */
  fps: number;
  /** Microsegundos entre el callback de GATT y el fin del volcado (Fase 0). */
  dispatchUs: number;
}

export function decodeLuaState(bytes: readonly number[] | null | undefined): LuaState | null {
  if (!bytes || bytes.length < 8) return null;
  return {
    mode: bytes[0] & 0xff,
    grantSecondsLeft: bytes[1] & 0xff,
    face: bytes[2] & 0xff,
    protocolVersion: bytes[3] & 0xff,
    fps: bytes[4] & 0xff,
    dispatchUs: (bytes[5] & 0xff) | ((bytes[6] & 0xff) << 8) | ((bytes[7] & 0xff) << 16),
  };
}

/** ¿Habla el aparato la misma versión de protocolo que este cliente? */
export const isLuaProtocolCompatible = (state: LuaState | null): boolean =>
  state !== null && state.protocolVersion === LUA_PROTOCOL_VERSION;

/* -------------------------------------------------------------------------- */
/*  base64 — lo que habla react-native-ble-plx                                 */
/* -------------------------------------------------------------------------- */

export function bytesToBase64(bytes: readonly number[] | Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte & 0xff);
  const globalBtoa = (globalThis as { btoa?: (data: string) => string }).btoa;
  if (typeof globalBtoa === 'function') return globalBtoa(binary);
  return require('buffer').Buffer.from(binary, 'binary').toString('base64');
}

export function base64ToBytes(b64: string): number[] {
  const globalAtob = (globalThis as { atob?: (data: string) => string }).atob;
  const binary =
    typeof globalAtob === 'function'
      ? globalAtob(b64)
      : require('buffer').Buffer.from(b64, 'base64').toString('binary');
  const out: number[] = [];
  for (let i = 0; i < binary.length; i++) out.push(binary.charCodeAt(i) & 0xff);
  return out;
}
