/* -------------------------------------------------------------------------- */
/*  Motor de audio COMPARTIDO de VIA+ (un único AudioContext para toda la app). */
/*                                                                             */
/*  POR QUÉ EXISTE ESTE MÓDULO                                                 */
/*  `react-native-audio-api` abre un stream de salida NATIVO por cada           */
/*  `new AudioContext()`:                                                       */
/*    · Android → Oboe con `SharingMode::Exclusive` (AudioPlayer.cpp). El       */
/*      primer contexto se queda el dispositivo en EXCLUSIVA; los siguientes    */
/*      fallan al abrir el stream y quedan MUDOS PARA SIEMPRE, sin lanzar       */
/*      ninguna excepción en JS (`isInitialized_ = false` → `start()` devuelve  */
/*      false y nadie lo mira).                                                 */
/*    · iOS → un AVAudioEngine compartido, pero cada `AudioPlayer.start()`      */
/*      PARA el motor para reconectar sus nodos, cortando lo que estuviera      */
/*      sonando en los demás contextos.                                        */
/*                                                                             */
/*  La app creaba cuatro contextos independientes (tonos de audiometría,        */
/*  palabras de la verbal, consignas habladas de los ejercicios y reproducción  */
/*  de las tomas del análisis acústico). En Android el que arrancaba primero    */
/*  se llevaba el altavoz y el resto de módulos se quedaba en silencio; cuál    */
/*  ganaba dependía del orden de montaje, de ahí que el fallo se percibiera     */
/*  como intermitente («a veces no suena»). Este módulo centraliza UN SOLO      */
/*  contexto con recuento de referencias: todos los módulos comparten el mismo  */
/*  stream nativo y ninguno puede dejar mudo a otro.                            */
/*                                                                             */
/*  SESIÓN DE AUDIO                                                             */
/*  Se centraliza también la sesión (iOS `AVAudioSession`): la reproducción es  */
/*  el modo por defecto (`playback`) y los módulos que necesitan micrófono      */
/*  piden `playAndRecord` con `acquireRecordingSession()`. Al soltar la última  */
/*  petición la sesión vuelve a `playback` sola: antes cada adaptador la        */
/*  reconfiguraba por su cuenta y el sonómetro dejaba la sesión en modo         */
/*  grabación (con la salida atenuada en iOS) si la pantalla se cerraba a       */
/*  mitad de una medición.                                                      */
/* -------------------------------------------------------------------------- */

import type {
  AudioBuffer,
  AudioBufferSourceNode,
  AudioDestinationNode,
  GainNode,
  OscillatorNode,
  StereoPannerNode,
} from 'react-native-audio-api';

/* Metro exige literales en `require(...)`: un `require(variable)` no empaqueta
 * el módulo. El require es opcional para que los tests y los targets sin el
 * módulo nativo sigan compilando (degradación: sin motor no hay sonido, pero
 * la app funciona). */
const optionalAudioApi = (): any => {
  try {
    return require('react-native-audio-api');
  } catch (_e) {
    return null;
  }
};

/** Frecuencia de muestreo única de toda la app (tonos, palabras y consignas). */
export const AUDIO_SAMPLE_RATE = 48000;

/**
 * Superficie del contexto que usa la app. Los tipos de los nodos vienen del
 * paquete (import SOLO de tipos: se borra al compilar, así que este módulo
 * sigue siendo el único que lo carga en runtime), de modo que los adaptadores
 * conservan el tipado fuerte de `createGain()`, `createOscillator()`, etc.
 */
export interface SharedAudioContext {
  readonly currentTime: number;
  readonly state?: string;
  readonly destination: AudioDestinationNode;
  sampleRate: number;
  createOscillator: () => OscillatorNode;
  createGain: () => GainNode;
  createStereoPanner: () => StereoPannerNode;
  createBufferSource: () => AudioBufferSourceNode;
  createBuffer: (channels: number, length: number, sampleRate: number) => AudioBuffer;
  decodeAudioData: (data: ArrayBuffer) => Promise<AudioBuffer>;
  decodeAudioDataSource: (path: string) => Promise<AudioBuffer>;
  resume?: () => Promise<boolean> | void;
  close?: () => Promise<void> | void;
}

let ctx: SharedAudioContext | null = null;
let refCount = 0;
/** El contexto no se pudo crear (target sin módulo nativo): no reintentar en bucle. */
let unavailable = false;

/* ------------------------------ sesión de audio --------------------------- */

const audioManager = (): any => optionalAudioApi()?.AudioManager ?? null;

/** Peticiones vivas de sesión de GRABACIÓN (sonómetro, análisis de voz…). */
let recordingHolders = 0;

const applyPlaybackSession = (): void => {
  const am = audioManager();
  if (!am) return;
  try {
    am.setAudioSessionOptions({
      iosCategory: 'playback',
      iosMode: 'default',
      iosOptions: ['defaultToSpeaker', 'allowBluetooth', 'allowBluetoothA2DP'],
    });
    void am.setAudioSessionActivity(true);
  } catch {
    /* target sin AudioManager: la sesión la gobierna el sistema */
  }
};

const applyRecordingSession = (): void => {
  const am = audioManager();
  if (!am) return;
  try {
    am.setAudioSessionOptions({
      iosCategory: 'playAndRecord',
      iosMode: 'measurement',
      iosOptions: ['defaultToSpeaker', 'allowBluetooth'],
    });
    void am.setAudioSessionActivity(true);
  } catch {
    /* target sin AudioManager */
  }
};

/**
 * Reserva la sesión de audio en modo GRABACIÓN (`playAndRecord`). Devuelve la
 * función de liberación; cuando se suelta la última petición la sesión vuelve
 * a `playback`. Es idempotente por llamador: llamar dos veces a la función de
 * liberación no descuenta dos veces.
 */
export function acquireRecordingSession(): () => void {
  recordingHolders += 1;
  if (recordingHolders === 1) applyRecordingSession();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    recordingHolders = Math.max(0, recordingHolders - 1);
    if (recordingHolders === 0) applyPlaybackSession();
  };
}

/** ¿Hay alguna captura de micrófono con la sesión reservada? (diagnóstico/tests) */
export const isRecordingSessionActive = (): boolean => recordingHolders > 0;

/* ------------------------------- el contexto ------------------------------ */

/**
 * Reserva el contexto de audio compartido, creándolo en la primera petición.
 * Devuelve `null` si el módulo nativo no está disponible (el llamador debe
 * degradar en silencio, nunca romper la pantalla).
 *
 * Cada `acquireAudioContext()` DEBE emparejarse con un `releaseAudioContext()`
 * (típicamente en la función de limpieza del `useEffect` que lo pidió).
 */
export function acquireAudioContext(): SharedAudioContext | null {
  refCount += 1;
  if (ctx) return ctx;
  if (unavailable) return null;

  const api = optionalAudioApi();
  if (!api?.AudioContext) {
    unavailable = true;
    return null;
  }
  try {
    // La sesión se configura ANTES de abrir el stream: en iOS el motor se
    // activa con la categoría vigente en ese momento.
    applyPlaybackSession();
    ctx = new api.AudioContext({ sampleRate: AUDIO_SAMPLE_RATE }) as SharedAudioContext;
    return ctx;
  } catch (e) {
    console.warn('VIA+: no se pudo abrir el motor de audio', e);
    unavailable = true;
    return null;
  }
}

/**
 * Suelta una reserva del contexto compartido. El contexto NO se cierra en el
 * primer release: solo cuando ya no queda ningún consumidor. Cerrar y reabrir
 * el stream nativo a cada navegación provocaba cortes de audio y, en Android,
 * carreras al reabrir el stream exclusivo.
 */
export function releaseAudioContext(): void {
  refCount = Math.max(0, refCount - 1);
  if (refCount > 0 || !ctx) return;
  const closing = ctx;
  ctx = null;
  try {
    void closing.close?.();
  } catch {
    /* noop */
  }
}

/**
 * Contexto compartido SIN tomar una referencia (para código que ya la tiene).
 * `null` si nadie lo ha reservado todavía.
 */
export const peekAudioContext = (): SharedAudioContext | null => ctx;

/**
 * Reactiva el contexto si el sistema lo suspendió (interrupción de llamada,
 * cambio de ruta de audio, vuelta de segundo plano). Un contexto suspendido
 * reproduce SILENCIO sin dar ningún error, así que conviene llamarlo justo
 * antes de programar un estímulo.
 */
export function resumeAudioContext(): void {
  if (!ctx) return;
  try {
    if (ctx.state && ctx.state !== 'running') void ctx.resume?.();
  } catch {
    /* state/resume no disponibles en algunos targets */
  }
}

/** ¿Hay motor de audio de salida utilizable? */
export const isAudioEngineAvailable = (): boolean => !unavailable;

/** Solo para tests: reinicia el estado del módulo. */
export function __resetSharedAudioContextForTests(): void {
  ctx = null;
  refCount = 0;
  recordingHolders = 0;
  unavailable = false;
}

/** Solo para tests/diagnóstico: nº de reservas vivas del contexto. */
export const audioContextRefCount = (): number => refCount;
