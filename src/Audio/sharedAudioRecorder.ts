/* -------------------------------------------------------------------------- */
/*  Micrófono COMPARTIDO de VIA+ (un único AudioRecorder para toda la app).     */
/*                                                                             */
/*  POR QUÉ EXISTE ESTE MÓDULO                                                 */
/*  Es el hermano de `sharedAudioContext`, para el lado de la ENTRADA. Aquel   */
/*  centralizó el stream de SALIDA porque `new AudioContext()` abre un stream  */
/*  exclusivo de Oboe y el segundo se queda mudo para siempre sin lanzar. Con  */
/*  `AudioRecorder` pasa lo mismo, y peor:                                     */
/*                                                                             */
/*    · El stream de entrada se abre en el CONSTRUCTOR (AndroidAudioRecorder   */
/*      abre Oboe con `SharingMode::Exclusive` ahí mismo).                     */
/*    · No hay `close()`: `stop()` solo hace `requestStop()`. El stream se     */
/*      cierra cuando el recolector de basura de JS libera el host object.     */
/*    · El constructor nativo IGNORA el `Result` de `openStream`, así que un   */
/*      segundo recorder falla EN SILENCIO: `start()` sobre un stream nulo no  */
/*      hace nada ni lanza. El micrófono simplemente deja de capturar.         */
/*                                                                             */
/*  Mientras solo el análisis de voz capturaba, bastaba con que su adaptador   */
/*  tuviera un único recorder interno. Al añadir el módulo de prosodia hay DOS */
/*  pantallas que graban, y dos adaptadores con un recorder propio cada uno    */
/*  reproducen exactamente el fallo original entre módulos: el que llegue      */
/*  segundo se queda mudo, sin ningún error, y el clínico ve una toma vacía.   */
/*                                                                             */
/*  Aquí hay UN recorder, UNA suscripción al motor nativo y reparto de los     */
/*  bloques a los consumidores vivos. Los adaptadores ya no construyen         */
/*  recorders: los piden.                                                      */
/*                                                                             */
/*  LÍMITE CONOCIDO. Al soltar la última reserva se abandona la referencia     */
/*  para que el GC cierre el stream, igual que hacía el adaptador de voz: no   */
/*  hay otra forma de cerrarlo. Si una pantalla se desmonta y otra pide el     */
/*  micrófono ANTES de que el GC haya pasado, el recorder nuevo puede abrirse  */
/*  sobre un stream todavía vivo. No es un riesgo que introduzca este módulo   */
/*  —existía ya entre visitas sucesivas a la misma pantalla— y compartir el    */
/*  recorder lo REDUCE, porque elimina el caso simultáneo, que es el común.    */
/* -------------------------------------------------------------------------- */

import { AUDIO_SAMPLE_RATE } from './sharedAudioContext';

/* Metro exige literales en `require(...)`: un `require(variable)` no empaqueta
 * el módulo. Opcional para que los tests y los targets sin el módulo nativo
 * sigan compilando (degradación: sin motor no hay captura, pero la app va). */
const optionalAudioApi = (): any => {
  try {
    return require('react-native-audio-api');
  } catch (_e) {
    return null;
  }
};

/** Frecuencia de captura del micrófono. Los consumidores decimarán si lo ven. */
export const RECORDER_SAMPLE_RATE = AUDIO_SAMPLE_RATE; // 48 kHz

/** Tamaño de bloque de captura (~100 ms). */
const BLOCK_SECONDS = 0.1;

/** Consumidor de bloques PCM crudos del micrófono (mono, `RECORDER_SAMPLE_RATE`). */
export type RecorderListener = (pcm: Float32Array) => void;

export interface SharedRecorder {
  /** Frecuencia real de los bloques entregados. */
  readonly sampleRate: number;
  /** Suscribe un consumidor. Devuelve la función de baja. */
  subscribe: (listener: RecorderListener) => () => void;
  /** Arranca la captura. Con varios consumidores, solo el primero arranca el
   *  motor; el resto se cuelga del stream ya abierto. */
  start: () => void;
  /** Detiene la captura cuando ya no queda ningún consumidor capturando. */
  stop: () => void;
  /** Suelta la reserva. Debe emparejarse con `acquireRecorder()`. */
  release: () => void;
}

let recorder: any = null;
let refCount = 0;
/** Consumidores con captura arrancada ahora mismo. */
let activeCaptures = 0;
let unavailable = false;
const listeners = new Set<RecorderListener>();

/**
 * Crea el recorder y su ÚNICA suscripción al motor nativo, o lo devuelve si ya
 * existe. El reparto es síncrono: cada consumidor recibe el mismo bloque y hace
 * su propio tratamiento (decimación, acondicionado…), que es estado suyo.
 */
function ensureRecorder(): any | null {
  if (recorder) return recorder;
  if (unavailable) return null;

  const api = optionalAudioApi();
  if (!api?.AudioRecorder) {
    unavailable = true;
    return null;
  }

  try {
    const created = new api.AudioRecorder({
      sampleRate: RECORDER_SAMPLE_RATE,
      bufferLengthInSamples: Math.round(RECORDER_SAMPLE_RATE * BLOCK_SECONDS),
    });

    created.onAudioReady(({ buffer }: { buffer: { getChannelData: (n: number) => Float32Array } }) => {
      if (!activeCaptures || !listeners.size) return;
      let pcm: Float32Array;
      try {
        pcm = buffer.getChannelData(0);
      } catch {
        return; // un bloque corrupto no debe tumbar la captura
      }
      // Copia de la lista: un consumidor puede darse de baja desde su callback
      // (fin de toma por tiempo máximo), y mutar el Set mientras se recorre
      // dejaría fuera al siguiente.
      for (const listener of Array.from(listeners)) {
        try {
          listener(pcm);
        } catch {
          /* el fallo de un consumidor no puede dejar sin audio a los demás */
        }
      }
    });

    recorder = created;
    return created;
  } catch (e) {
    console.warn('VIA+: no se pudo abrir el micrófono compartido', e);
    unavailable = true;
    return null;
  }
}

/**
 * Reserva el micrófono compartido. Devuelve `null` si no hay motor de captura
 * (el llamador debe degradar, nunca romper la pantalla).
 *
 * Cada `acquireRecorder()` DEBE emparejarse con un `release()`.
 */
export function acquireRecorder(): SharedRecorder | null {
  refCount += 1;
  const native = ensureRecorder();
  if (!native) {
    refCount = Math.max(0, refCount - 1);
    return null;
  }

  let released = false;
  let capturing = false;
  let unsubscribe: (() => void) | null = null;

  const handle: SharedRecorder = {
    sampleRate: RECORDER_SAMPLE_RATE,

    subscribe: (listener: RecorderListener) => {
      listeners.add(listener);
      const off = () => listeners.delete(listener);
      unsubscribe = off;
      return off;
    },

    start: () => {
      if (released || capturing) return;
      capturing = true;
      activeCaptures += 1;
      // Solo el primero arranca el motor: `start()` sobre un stream ya
      // arrancado es, en el mejor caso, redundante.
      if (activeCaptures === 1) {
        try {
          native.start();
        } catch {
          /* noop */
        }
      }
    },

    stop: () => {
      if (released || !capturing) return;
      capturing = false;
      activeCaptures = Math.max(0, activeCaptures - 1);
      if (activeCaptures === 0) {
        try {
          native.stop();
        } catch {
          /* noop */
        }
      }
    },

    release: () => {
      if (released) return;
      handle.stop();
      released = true;
      unsubscribe?.();
      unsubscribe = null;
      refCount = Math.max(0, refCount - 1);
      if (refCount === 0) {
        // Se abandona la referencia para que el GC cierre el stream: es la
        // única vía, porque `AudioRecorder` no expone `close()`.
        try {
          recorder?.stop();
        } catch {
          /* noop */
        }
        recorder = null;
        listeners.clear();
        activeCaptures = 0;
      }
    },
  };

  return handle;
}

/** ¿Hay motor de captura utilizable? */
export const isRecorderAvailable = (): boolean => !unavailable;

/** Solo para tests/diagnóstico: nº de reservas vivas del micrófono. */
export const recorderRefCount = (): number => refCount;

/** Solo para tests: reinicia el estado del módulo. */
export function __resetSharedAudioRecorderForTests(): void {
  recorder = null;
  refCount = 0;
  activeCaptures = 0;
  unavailable = false;
  listeners.clear();
}
