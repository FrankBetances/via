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
/*    · No hay `close()` en JS: el stream se cierra en el DESTRUCTOR de C++,   */
/*      o sea cuando el recolector de basura de JS libera el host object.      */
/*      `stop()` solo hace `requestStop()`.                                    */
/*    · El constructor nativo IGNORA el `Result` de `openStream`, así que un   */
/*      segundo recorder falla EN SILENCIO: `start()` sobre un stream nulo no  */
/*      hace nada ni lanza. El micrófono simplemente deja de capturar.         */
/*                                                                             */
/*  DOS FALLOS DE CAMPO QUE ESTE MÓDULO NO CUBRÍA (y ahora sí)                 */
/*                                                                             */
/*  1. RECONSTRUCCIÓN ENTRE PANTALLAS. La versión anterior soltaba la          */
/*     referencia al llegar el recuento de reservas a cero, «para que el GC    */
/*     cierre el stream». Pero el GC no corre cuando a uno le conviene: al     */
/*     pasar del T.A.R. al análisis de voz —o de la voz a la prosodia— el      */
/*     recorder nuevo se construía con el stream anterior TODAVÍA ABIERTO en   */
/*     modo exclusivo, `openStream` fallaba y el módulo entrante se quedaba    */
/*     mudo sin ningún error. Es exactamente el «grabo, guarda el audio y      */
/*     luego dice captura insuficiente» reportado en campo, y el motivo de que */
/*     pareciera aleatorio: dependía del orden de visita a los módulos.        */
/*                                                                             */
/*     Ahora el recorder es un SINGLETON DE PROCESO. Se crea una vez y no se   */
/*     suelta nunca: sin segunda apertura no hay carrera posible. Al quedarse  */
/*     sin consumidores se para (`stop()`), que es lo que apaga el indicador   */
/*     de micrófono del sistema y libera el hardware de captura; el stream     */
/*     queda abierto pero parado, que es el estado que la librería contempla   */
/*     para reutilizarlo en la toma siguiente.                                 */
/*                                                                             */
/*  2. CONSTRUCCIÓN SIN PERMISO. Como el stream se abre en el constructor, un  */
/*     recorder creado ANTES de que el usuario conceda RECORD_AUDIO nace       */
/*     muerto: Oboe no puede abrir la entrada y el objeto queda cacheado sin   */
/*     stream. El T.A.R. lo pedía al montar la pantalla, o sea antes de pedir  */
/*     el permiso, y envenenaba el micrófono del resto de módulos.             */
/*                                                                             */
/*     Ahora la reserva (`acquireRecorder`) NO construye nada: solo comprueba  */
/*     que el motor de captura existe. El objeto nativo se crea en el primer   */
/*     `start()`, y solo si el permiso está confirmado                         */
/*     (`setRecorderPermissionGranted`). Lo que no tiene permiso, no se abre.  */
/*                                                                             */
/*  AUTORREPARACIÓN. Si aun así una toma termina sin haber recibido un solo    */
/*  bloque, la instancia se marca como sospechosa y la toma siguiente          */
/*  reconstruye el recorder. No es gratis (puede volver a chocar con el stream */
/*  viejo), pero un recorder que no entrega audio no tiene nada que perder.    */
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

/**
 * Duración mínima de una toma para que «cero bloques» signifique algo. Una
 * toma abierta y cerrada en el mismo suspiro no ha dado tiempo al motor a
 * entregar nada y no debe marcar el recorder como averiado.
 */
const SILENT_CAPTURE_MIN_MS = 700;

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

/** Estado del motor de captura, para que las pantallas puedan EXPLICARLO. */
export type RecorderHealth =
  | 'unknown' // todavía no se ha intentado ninguna toma
  | 'live' // la última toma recibió bloques
  | 'silent' // la última toma no recibió NI UN bloque (stream muerto)
  | 'no-permission' // no se ha confirmado el permiso de micrófono
  | 'no-engine'; // el módulo nativo de captura no está en este binario

let recorder: any = null;
let refCount = 0;
/** Consumidores con captura arrancada ahora mismo. */
let activeCaptures = 0;
/** El binario no trae motor de captura: no hay nada que reintentar. */
let engineMissing = false;
/** ¿Se ha confirmado RECORD_AUDIO? El stream se abre en el constructor. */
let permissionGranted = false;
/** La instancia viva no entregó audio en la última toma: reconstruir. */
let suspect = false;
/** Bloques recibidos desde el último arranque del motor. */
let blocksSinceStart = 0;
/** Momento del último arranque del motor (ms), para el juicio de «muda». */
let startedAt = 0;
let health: RecorderHealth = 'unknown';
const listeners = new Set<RecorderListener>();

/**
 * Confirma (o retira) el permiso de micrófono. Lo llaman los adaptadores en
 * cuanto el sistema responde, ANTES de arrancar la primera toma: como el
 * stream nativo se abre en el constructor, un recorder creado sin permiso nace
 * sin stream y se queda así para siempre.
 */
export function setRecorderPermissionGranted(granted: boolean): void {
  if (permissionGranted === granted) return;
  permissionGranted = granted;
  // Un recorder construido en un momento sin permiso no sirve de nada: que la
  // próxima toma lo rehaga ahora que sí lo hay.
  if (granted && recorder) suspect = true;
  if (!granted) health = 'no-permission';
}

/** ¿Se ha confirmado el permiso de micrófono en esta sesión de la app? */
export const isRecorderPermissionGranted = (): boolean => permissionGranted;

/** Motor de captura del paquete nativo, o `null` si el binario no lo trae. */
function recorderFactory(): any | null {
  if (engineMissing) return null;
  const api = optionalAudioApi();
  if (!api?.AudioRecorder) {
    engineMissing = true;
    health = 'no-engine';
    return null;
  }
  return api.AudioRecorder;
}

/**
 * Crea el recorder y su ÚNICA suscripción al motor nativo, o lo devuelve si ya
 * existe. El reparto es síncrono: cada consumidor recibe el mismo bloque y hace
 * su propio tratamiento (decimación, acondicionado…), que es estado suyo.
 *
 * Se llama desde `start()`, NUNCA desde `acquireRecorder()`: abrir el stream
 * exige tener ya el permiso concedido.
 */
function ensureRecorder(): any | null {
  if (recorder && !suspect) return recorder;

  const AudioRecorderCtor = recorderFactory();
  if (!AudioRecorderCtor) return null;

  if (!permissionGranted) {
    health = 'no-permission';
    return null;
  }

  if (recorder && suspect) {
    // La instancia viva no entrega audio. Se para y se abandona para que el GC
    // ejecute el destructor de C++ (el único que cierra el stream) y se
    // construye otra: un recorder mudo no tiene nada que conservar.
    try {
      recorder.stop();
    } catch {
      /* noop */
    }
    // Las suscripciones son del MÓDULO, no del objeto nativo: sobreviven a la
    // reconstrucción y el `onAudioReady` del recorder nuevo las reparte igual.
    recorder = null;
  }
  suspect = false;

  try {
    const created = new AudioRecorderCtor({
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
      blocksSinceStart += 1;
      health = 'live';
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
    // NO se latchea «no disponible»: la apertura puede fallar por una causa
    // transitoria (otra app con el micrófono, stream anterior sin recoger) y
    // latcharlo dejaba la app sin micrófono hasta reiniciarla.
    recorder = null;
    return null;
  }
}

/**
 * Reserva el micrófono compartido. Devuelve `null` SOLO si este binario no
 * trae motor de captura (el llamador debe degradar, nunca romper la pantalla).
 *
 * Reservar NO abre el stream: eso ocurre en el primer `start()`, con el
 * permiso ya concedido. Cada `acquireRecorder()` DEBE emparejarse con un
 * `release()`.
 */
export function acquireRecorder(): SharedRecorder | null {
  if (!recorderFactory()) return null;
  refCount += 1;

  let released = false;
  let capturing = false;
  const mine = new Set<RecorderListener>();

  const handle: SharedRecorder = {
    sampleRate: RECORDER_SAMPLE_RATE,

    subscribe: (listener: RecorderListener) => {
      listeners.add(listener);
      mine.add(listener);
      return () => {
        listeners.delete(listener);
        mine.delete(listener);
      };
    },

    start: () => {
      if (released || capturing) return;
      const native = ensureRecorder();
      if (!native) {
        // Con permiso concedido, no poder abrir el stream es un fallo del
        // motor (otra app lo tiene, o el stream anterior sigue sin recoger).
        if (permissionGranted && !engineMissing) health = 'silent';
        return; // `health` dice por qué; el llamador degrada, no rompe
      }
      capturing = true;
      activeCaptures += 1;
      // Solo el primero arranca el motor: `start()` sobre un stream ya
      // arrancado es, en el mejor caso, redundante.
      if (activeCaptures === 1) {
        blocksSinceStart = 0;
        startedAt = Date.now();
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
          recorder?.stop();
        } catch {
          /* noop */
        }
        // Una toma de duración razonable que no recibió NI UN bloque es un
        // stream muerto: se marca para que la siguiente reconstruya.
        if (blocksSinceStart === 0 && Date.now() - startedAt >= SILENT_CAPTURE_MIN_MS) {
          suspect = true;
          health = 'silent';
        }
      }
    },

    release: () => {
      if (released) return;
      handle.stop();
      released = true;
      for (const listener of mine) listeners.delete(listener);
      mine.clear();
      refCount = Math.max(0, refCount - 1);
      // El recorder NO se suelta al llegar a cero: es un singleton de proceso.
      // Reconstruirlo entre pantallas era el fallo que dejaba mudo al módulo
      // entrante (ver la cabecera). Queda parado y listo para la toma
      // siguiente, sin retener la captura ni el indicador del sistema.
    },
  };

  return handle;
}

/** ¿Hay motor de captura utilizable en este binario? */
export const isRecorderAvailable = (): boolean => !engineMissing && !!recorderFactory();

/** Estado del motor de captura, para que la pantalla pueda explicar el fallo. */
export const recorderHealth = (): RecorderHealth => health;

/** Solo para tests/diagnóstico: nº de reservas vivas del micrófono. */
export const recorderRefCount = (): number => refCount;

/** Solo para tests: reinicia el estado del módulo. */
export function __resetSharedAudioRecorderForTests(): void {
  recorder = null;
  refCount = 0;
  activeCaptures = 0;
  engineMissing = false;
  permissionGranted = false;
  suspect = false;
  blocksSinceStart = 0;
  startedAt = 0;
  health = 'unknown';
  listeners.clear();
}
