/* -------------------------------------------------------------------------- */
/*  Lúa — códec del protocolo GATT (periférico de refuerzo).                    */
/*                                                                             */
/*  Módulo PURO: sin dependencias nativas, sin estado, sin BLE. Todo lo que    */
/*  viaja por el aire se construye y se interpreta aquí, y por eso este fichero*/
/*  es el sitio donde se vigila la restricción regulatoria del diseño:         */
/*                                                                             */
/*    · Por el enlace viajan ESTADOS AFECTIVOS ABSTRACTOS y nada más. No hay   */
/*      «acierto», no hay «fallo», no hay puntuación, umbral ni resultado.     */
/*      Ese vacío no es una omisión: es lo que sostiene que Lúa no sea un      */
/*      accesorio de un producto sanitario y quede fuera del expediente MDR    */
/*      (docs/design/integracion-lua.md §4). Ampliar `LuaAffect` con cualquier */
/*      semántica clínica invalida ese razonamiento, y por eso el enumerado    */
/*      vive en un fichero que no se puede tocar sin que se vea en el PR.      */
/*                                                                             */
/*    · El permiso de ruido es un PERMISO CON CADUCIDAD, no una orden de        */
/*      silencio. Lúa arranca muda y solo puede sonar mientras sostenga un     */
/*      permiso vigente. Perder el enlace, cerrar la app o dormir la tableta   */
/*      convergen en silencio dentro del TTL (§3). Nunca se codifica un        */
/*      «puedes sonar» sin fecha de caducidad.                                 */
/*                                                                             */
/*  Referencia: docs/design/integracion-lua.md §5.                             */
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/*  UUIDs                                                                      */
/*                                                                             */
/*  Base `6c7561XX-b17e-4f4d-9a2f-0a1b2c3d4e5f`, donde `6c 75 61` es «lua» en  */
/*  ASCII y `XX` numera servicio (00) y características (01…04).               */
/* -------------------------------------------------------------------------- */

const LUA_UUID_SUFFIX = '-b17e-4f4d-9a2f-0a1b2c3d4e5f';
const luaUuid = (slot: number): string =>
  `6c7561${slot.toString(16).padStart(2, '0')}${LUA_UUID_SUFFIX}`;

export const LUA_SERVICE_UUID = luaUuid(0x00);
/** Read — versión de protocolo + mapa de bits de hardware presente. */
export const LUA_CAPABILITIES_UUID = luaUuid(0x01);
/** Write sin respuesta — estado afectivo + intensidad. */
export const LUA_EXPRESSION_UUID = luaUuid(0x02);
/** Write sin respuesta — permiso de ruido con caducidad. */
export const LUA_NOISE_PERMIT_UUID = luaUuid(0x03);
/** Notify — estado del firmware, batería, flags, eco de secuencia. */
export const LUA_STATUS_UUID = luaUuid(0x04);

/** Versión de protocolo que implementa este cliente. */
export const LUA_PROTOCOL_VERSION = 1;

/* -------------------------------------------------------------------------- */
/*  Estados afectivos                                                          */
/* -------------------------------------------------------------------------- */

/**
 * El enumerado completo. Deliberadamente pobre en semántica: describe cómo se
 * comporta una gata, no qué ha medido VIA+. Si algún día hace falta reforzar
 * «un acierto», lo que se envía es `Contenta`, y la traducción de mérito
 * clínico a afecto se queda en la tableta.
 */
export enum LuaAffect {
  Dormida = 0,
  Neutra = 1,
  Atenta = 2,
  Contenta = 3,
  Celebracion = 4,
  Carino = 5,
}

/** Los valores admitidos, para validar tramas y para recorrer el enumerado. */
export const LUA_AFFECTS: readonly LuaAffect[] = [
  LuaAffect.Dormida,
  LuaAffect.Neutra,
  LuaAffect.Atenta,
  LuaAffect.Contenta,
  LuaAffect.Celebracion,
  LuaAffect.Carino,
];

const isAffect = (value: number): value is LuaAffect => LUA_AFFECTS.includes(value as LuaAffect);

/* -------------------------------------------------------------------------- */
/*  Capacidades                                                                */
/* -------------------------------------------------------------------------- */

export const LUA_CAP_DISPLAY = 0b0001;
export const LUA_CAP_SPEAKER = 0b0010;
export const LUA_CAP_MOTORS = 0b0100;
export const LUA_CAP_RTC = 0b1000;

export interface LuaCapabilities {
  protocolVersion: number;
  display: boolean;
  speaker: boolean;
  motors: boolean;
  rtc: boolean;
}

/**
 * Interpreta la característica de capacidades. El cliente la lee al conectar y
 * ajusta la política con ella: sobre Lúa v1 (pantalla y nada más) el permiso de
 * ruido no se envía nunca, y el mismo código sirve para una v2 con altavoz sin
 * bifurcarse.
 */
export function decodeCapabilities(bytes: readonly number[] | null | undefined): LuaCapabilities | null {
  if (!bytes || bytes.length < 2) return null;
  const mask = bytes[1] & 0xff;
  return {
    protocolVersion: bytes[0] & 0xff,
    display: (mask & LUA_CAP_DISPLAY) !== 0,
    speaker: (mask & LUA_CAP_SPEAKER) !== 0,
    motors: (mask & LUA_CAP_MOTORS) !== 0,
    rtc: (mask & LUA_CAP_RTC) !== 0,
  };
}

/**
 * ¿Puede este periférico hacer ruido o moverse? Es la pregunta que decide si el
 * permiso de ruido tiene sentido siquiera. Ante capacidades desconocidas
 * (`null`) la respuesta es **no**: sin saber qué hay al otro lado no se concede
 * nada. Que la respuesta segura sea también la respuesta por omisión es todo el
 * diseño de §3 en una línea.
 */
export const luaCanMakeNoise = (caps: LuaCapabilities | null): boolean =>
  caps !== null && (caps.speaker || caps.motors);

/* -------------------------------------------------------------------------- */
/*  Expresión                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Codifica una expresión. Devuelve `null` si el estado afectivo no está en el
 * enumerado, en vez de enviar un byte que el firmware tendría que interpretar:
 * un `4242` colado por un módulo que quisiera pasar una puntuación por aquí no
 * llega al aire.
 */
export function encodeExpression(affect: number, intensity = 255): number[] | null {
  if (!Number.isInteger(affect) || !isAffect(affect)) return null;
  return [affect & 0xff, clampByte(intensity)];
}

/* -------------------------------------------------------------------------- */
/*  Permiso de ruido                                                           */
/* -------------------------------------------------------------------------- */

/** Primer byte de toda trama de permiso: descarta escrituras accidentales. */
export const LUA_NOISE_PERMIT_MAGIC = 0xa5;

/** Vida del permiso: 3 s. Sin renovación, el firmware vuelve a mudo. */
export const LUA_NOISE_PERMIT_TTL_MS = 3000;
/** Cadencia de renovación: 1 s, o sea tres oportunidades por TTL. */
export const LUA_NOISE_PERMIT_RENEWAL_MS = 1000;

/** El TTL viaja en DÉCIMAS de segundo en un `u8`: 25,5 s es el techo físico. */
export const LUA_NOISE_PERMIT_MAX_TTL_MS = 255 * 100;

/**
 * Codifica un permiso de ruido. `ttlMs` a 0 es la revocación explícita (mudo
 * inmediato), que se envía como cortesía al salir de una pantalla permitida: el
 * silencio no depende de que esa trama llegue —para eso está la caducidad— pero
 * si llega, se adelanta al vencimiento.
 *
 * Devuelve `null` si el TTL pedido excede el techo del campo, en vez de
 * truncarlo en silencio: un permiso más corto de lo que cree el llamador haría
 * parpadear a la gata; uno más largo es un riesgo, y ninguno de los dos debe
 * pasar inadvertido.
 */
export function encodeNoisePermit(ttlMs: number, sequence: number): number[] | null {
  if (!Number.isFinite(ttlMs) || ttlMs < 0 || ttlMs > LUA_NOISE_PERMIT_MAX_TTL_MS) return null;
  const deciseconds = Math.round(ttlMs / 100);
  return [LUA_NOISE_PERMIT_MAGIC, deciseconds & 0xff, clampByte(sequence)];
}

/** Trama de revocación inmediata. */
export const encodeNoiseRevocation = (sequence: number): number[] => [
  LUA_NOISE_PERMIT_MAGIC,
  0x00,
  clampByte(sequence),
];

/** Siguiente número de secuencia (`u8` con vuelta a cero). */
export const nextSequence = (sequence: number): number => (clampByte(sequence) + 1) & 0xff;

/* -------------------------------------------------------------------------- */
/*  Estado                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Estado del firmware. NORMATIVO para la F1: el firmware del ESP32 tiene que
 * publicar exactamente estos valores. `Muda` es el estado de arranque y el
 * estado al que se vuelve solo, sin que nadie lo pida, al vencer el permiso.
 */
export enum LuaFirmwareState {
  Muda = 0,
  ConPermisoDeRuido = 1,
  Fallo = 2,
}

export const LUA_STATUS_FLAG_CHARGING = 0b0001;
export const LUA_STATUS_FLAG_LOW_BATTERY = 0b0010;

export interface LuaStatus {
  state: LuaFirmwareState;
  /** Batería en %, o `null` si la placa no la mide (Lúa v1 puede no medirla). */
  batteryPct: number | null;
  charging: boolean;
  lowBattery: boolean;
  /** Eco del último número de secuencia recibido, para diagnosticar el enlace. */
  sequenceEcho: number;
}

/**
 * Interpreta una notificación de estado. Es información de DIAGNÓSTICO: ninguna
 * decisión de VIA+ la lee y no entra en ningún informe (§4). Batería 0xFF
 * significa «no medida», no «descargada».
 */
export function decodeStatus(bytes: readonly number[] | null | undefined): LuaStatus | null {
  if (!bytes || bytes.length < 4) return null;
  const rawState = bytes[0] & 0xff;
  const rawBattery = bytes[1] & 0xff;
  const flags = bytes[2] & 0xff;
  return {
    state: rawState <= LuaFirmwareState.Fallo ? (rawState as LuaFirmwareState) : LuaFirmwareState.Fallo,
    batteryPct: rawBattery === 0xff ? null : Math.min(100, rawBattery),
    charging: (flags & LUA_STATUS_FLAG_CHARGING) !== 0,
    lowBattery: (flags & LUA_STATUS_FLAG_LOW_BATTERY) !== 0,
    sequenceEcho: bytes[3] & 0xff,
  };
}

/* -------------------------------------------------------------------------- */
/*  Utilidades                                                                 */
/* -------------------------------------------------------------------------- */

function clampByte(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(255, Math.round(value)));
}

/* `react-native-ble-plx` habla base64 en las dos direcciones. La conversión
 * vive aquí, con el resto del códec, para que el adaptador BLE no tenga lógica
 * que probar. Igual que en el adaptador del pulsioxímetro, se usa el `atob`/
 * `btoa` global de RN y se cae a `buffer` donde no exista (Node de los tests). */

export function bytesToBase64(bytes: readonly number[]): string {
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
