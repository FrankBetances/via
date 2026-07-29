import { PermissionsAndroid, Platform } from 'react-native';
import { AudioManager, AudioRecorder } from 'react-native-audio-api';
import type { AudioBufferSourceNode } from 'react-native-audio-api';

import {
  acquireAudioContext,
  acquireRecordingSession,
  releaseAudioContext,
  resumeAudioContext,
  type SharedAudioContext,
} from '@/Audio';
import { setVoiceMicAdapter, VoiceLiveFrame, VoiceMicAdapter } from './useVoiceAnalysis';
import {
  analyseFrame,
  analysePcm,
  createDecimator3,
  createVoiceHighpass,
  DECIMATION,
  FRAME,
  SAMPLE_RATE,
} from './voiceDsp';

/* -------------------------------------------------------------------------- */
/*  voiceMicAdapter — captura, reproducción y análisis REAL del micrófono     */
/* -------------------------------------------------------------------------- */
/*  Motor: `react-native-audio-api` ≥ 0.8 (AudioRecorder, Oboe/AVAudioEngine),*/
/*  el mismo paquete nativo que sintetiza los tonos de las audiometrías. El    */
/*  adaptador anterior usaba `react-native-live-audio-stream` (módulo del      */
/*  puente antiguo) que bajo la nueva arquitectura de RN 0.80 colgaba la app.  */
/*  OJO: `AudioRecorder`/`AudioManager` no existen en versiones < 0.6 del      */
/*  paquete (con 0.5.x el import es `undefined` y la grabación falla).         */
/*                                                                             */
/*  Pipeline:                                                                  */
/*   · Captura PCM mono a 48 kHz en bloques de ~100 ms.                        */
/*   · Cada bloque se decima ×3 (→16 kHz efectivos) y se analiza EN VIVO       */
/*     (RMS + F0 por autocorrelación) para el feedback de pantalla.            */
/*   · `stopRecording` SOLO devuelve el PCM concatenado (rápido): el análisis  */
/*     pesado que antes vivía aquí bloqueaba el hilo JS varios segundos y la   */
/*     pantalla parecía colgada al terminar la grabación.                      */
/*   · `analyse(pcm)` — bajo demanda, por ventanas de 1024 muestras (~64 ms),  */
/*     cediendo el hilo JS cada pocas ventanas para no congelar la UI:         */
/*       - RMS (amplitud → shimmer aguas arriba)                               */
/*       - F0 por autocorrelación normalizada en 70–500 Hz                     */
/*       - HNR desde el pico de autocorrelación r: 10·log10(r/(1−r))           */
/*       - Formantes F1–F3 por LPC (Levinson-Durbin) + picos de la envolvente  */
/*     Solo se aceptan ventanas sonoras (RMS y periodicidad mínimos).          */
/*   · `play(pcm)` — reproducción de la toma vía AudioBufferSourceNode (el     */
/*     PCM de 16 kHz se re-expande ×3 a 48 kHz por interpolación lineal para   */
/*     coincidir con la frecuencia del contexto de reproducción).              */
/* -------------------------------------------------------------------------- */

// Cadena de captura: el recorder nativo entrega 48 kHz y el adaptador decima ×3
// (con filtro FIR anti-alias, ver `createDecimator3`) hasta la frecuencia
// efectiva del DSP (`SAMPLE_RATE` = 16 kHz).
const DECIMATE = DECIMATION;
const CAPTURE_SR = SAMPLE_RATE * DECIMATE; // 48000

/** Espera tras `stop()` para recoger los últimos bloques que el motor nativo
 *  entrega por el emisor de eventos (ver `stopRecording`). */
const TAIL_DRAIN_MS = 120;

/* -------------------------------------------------------------------------- */
/*  CICLO DE VIDA DEL RECORDER (bug «el micrófono no captura»)                 */
/*                                                                            */
/*  `AudioRecorder` de react-native-audio-api 0.8 NO tiene `close()`: el       */
/*  stream nativo se abre en el CONSTRUCTOR (AndroidAudioRecorder abre el      */
/*  stream de entrada de Oboe con `SharingMode::Exclusive` en su constructor,  */
/*  ver android/src/main/cpp/.../AndroidAudioRecorder.cpp) y solo se cierra    */
/*  cuando el objeto se destruye, es decir, cuando el recolector de basura de  */
/*  JS libera el host object. `stop()` únicamente hace `requestStop()`.        */
/*                                                                            */
/*  El adaptador construía un `AudioRecorder` NUEVO en cada grabación. Cada    */
/*  toma dejaba, por tanto, un stream de entrada abierto a la espera del GC;   */
/*  a partir de la segunda o tercera, abrir uno más falla —y falla EN          */
/*  SILENCIO, porque el constructor nativo ignora el `Result` de `openStream`  */
/*  y `start()` sobre un stream nulo no hace nada ni lanza—. El resultado es   */
/*  exactamente lo reportado: el micrófono deja de capturar y no se genera     */
/*  nada, sin ningún error.                                                    */
/*                                                                            */
/*  Además, cada `onAudioReady()` registra una suscripción nueva en el emisor  */
/*  de eventos y solo la última queda conectada al nativo: las anteriores      */
/*  quedaban vivas para siempre.                                               */
/*                                                                            */
/*  Solución: UN ÚNICO recorder por registro del adaptador, creado de forma    */
/*  perezosa, con UNA sola suscripción `onAudioReady` que despacha al          */
/*  consumidor vigente. `start`/`stop` reutilizan la misma instancia, que es   */
/*  el ciclo que la librería contempla.                                        */
/* -------------------------------------------------------------------------- */

/** Sin bloques en este plazo tras arrancar, el stream está mudo. */
const CAPTURE_WATCHDOG_MS = 1200;

/* ------------------------------- permisos --------------------------------- */

async function ensureMicPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, {
      title: 'Permiso de micrófono',
      message: 'Se necesita el micrófono para grabar la voz del niño/a.',
      buttonPositive: 'Permitir',
    });
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }
  try {
    const perm = await AudioManager.requestRecordingPermissions();
    return perm === 'Granted';
  } catch {
    return true; // targets sin AudioManager: el recorder pedirá el permiso
  }
}

/* ------------------------------- adaptador -------------------------------- */

let registered = false;
/** Limpieza del adaptador vivo (referencias nativas del registro en curso). */
let disposeCurrent: (() => void) | null = null;

/**
 * Registra el adaptador de micrófono real (idempotente; la pantalla lo llama
 * en su `useEffect` de montaje). Devuelve `true` si el motor está disponible.
 */
export function registerVoiceMicAdapter(): boolean {
  if (registered) return true;

  /** Recorder ÚNICO del adaptador (ver la nota de ciclo de vida de arriba). */
  let recorder: AudioRecorder | null = null;
  /** ¿Está el stream nativo entregando bloques ahora mismo? */
  let capturing = false;
  /** Vigilante de «stream abierto pero mudo» de la toma en curso. */
  let watchdog: ReturnType<typeof setTimeout> | null = null;

  const clearWatchdog = () => {
    if (watchdog) clearTimeout(watchdog);
    watchdog = null;
  };
  let chunks: Float32Array[] = [];
  let decimate: ((raw: Float32Array) => Float32Array) | null = null;
  /** Pasa-alto de acondicionado del feedback EN VIVO (la toma se guarda cruda
   *  y `analysePcm` la acondiciona por su cuenta). Sin él, la F0 en vivo
   *  saltaba al doble en cuanto había deriva de línea de base. */
  const liveHighpass = createVoiceHighpass(SAMPLE_RATE);
  /** Bloques entregados por el motor nativo desde el último arranque: permite
   *  distinguir «el micrófono no da audio» de «no se emitió voz». */
  let blocksReceived = 0;
  // Reproducción de las tomas sobre el contexto COMPARTIDO de la app: crear
  // aquí un AudioContext propio abría un segundo stream nativo que en Android
  // (Oboe exclusivo) se quedaba mudo, así que la toma grabada no se oía.
  let playbackCtx: SharedAudioContext | null = null;
  let playbackSource: AudioBufferSourceNode | null = null;
  /** Liberación de la sesión de grabación en curso (`null` = no reservada). */
  let releaseSession: (() => void) | null = null;

  const endRecordingSession = () => {
    releaseSession?.();
    releaseSession = null;
  };

  const stopPlayback = () => {
    if (playbackSource) {
      const source = playbackSource;
      playbackSource = null;
      try {
        source.onEnded = null;
        source.stop();
      } catch {
        /* ya parado */
      }
      try {
        source.disconnect();
      } catch {
        /* noop */
      }
    }
  };

  /** Consumidor de feedback en vivo de la grabación en curso. */
  let liveListener: ((frame: VoiceLiveFrame) => void) | null = null;

  /**
   * Devuelve el recorder del adaptador, creándolo (y suscribiéndose) UNA sola
   * vez. Nunca se construye uno por grabación: ver la nota de ciclo de vida.
   */
  const ensureRecorder = (): AudioRecorder => {
    if (recorder) return recorder;

    const created = new AudioRecorder({
      sampleRate: CAPTURE_SR,
      bufferLengthInSamples: Math.round(CAPTURE_SR * 0.1), // ~100 ms
    });

    // Suscripción ÚNICA: despacha al estado de la grabación vigente.
    created.onAudioReady(({ buffer }) => {
      if (!capturing) return; // stream vivo pero fuera de una toma
      try {
        const raw = buffer.getChannelData(0) as Float32Array;
        // Decimación ×3 con anti-alias → 16 kHz efectivos para el análisis.
        const ds = decimate ? decimate(raw) : new Float32Array(0);
        if (!ds.length) return;
        blocksReceived += 1;
        // La toma se guarda CRUDA (para que la reproducción suene como se
        // grabó); el acondicionado se aplica al analizar.
        chunks.push(ds);

        if (liveListener) {
          // El feedback en vivo sí se acondiciona aquí, con estado continuo.
          const clean = liveHighpass.process(ds);
          const win = clean.length >= FRAME ? clean.subarray(clean.length - FRAME) : clean;
          let sum = 0;
          for (let i = 0; i < win.length; i++) sum += win[i] * win[i];
          const rms = Math.sqrt(sum / (win.length || 1));
          const frame = win.length >= FRAME ? analyseFrame(win as Float32Array) : null;
          liveListener({ f0: frame ? frame.f0 : null, rms });
        }
      } catch {
        /* un bloque corrupto no debe tumbar la captura */
      }
    });

    recorder = created;
    return created;
  };

  const adapter: VoiceMicAdapter = {
    sampleRate: SAMPLE_RATE,

    startRecording: async (onLive?: (frame: VoiceLiveFrame) => void) => {
      const granted = await ensureMicPermission();
      if (!granted) throw new Error('Permiso de micrófono denegado');

      stopPlayback();
      endRecordingSession();
      releaseSession = acquireRecordingSession();

      chunks = [];
      blocksReceived = 0;
      decimate = createDecimator3();
      liveHighpass.reset();
      liveListener = onLive ?? null;

      // El permiso puede acabar de concederse: el stream nativo se abre en el
      // CONSTRUCTOR, así que crearlo aquí (y no antes) garantiza que se abre
      // con el permiso ya vigente.
      const active = ensureRecorder();
      capturing = true;
      active.start();

      // El motor nativo no informa de que el stream no se abrió: `start()`
      // sobre un stream nulo no hace nada ni lanza. Si en este plazo no ha
      // llegado ningún bloque, se avisa en vez de dejar la pantalla grabando
      // un silencio que nunca existió.
      clearWatchdog();
      watchdog = setTimeout(() => {
        watchdog = null;
        if (capturing && blocksReceived === 0) {
          console.warn(
            'VIA+: el micrófono no entregó ningún bloque tras arrancar la captura ' +
              '(¿ocupado por otra aplicación o silenciado por el sistema?)',
          );
        }
      }, CAPTURE_WATCHDOG_MS);
    },

    stopRecording: async (): Promise<Float32Array> => {
      try {
        recorder?.stop();
      } catch {
        /* noop */
      }
      // El recorder se CONSERVA (su stream nativo se reutiliza en la toma
      // siguiente); solo se cierra al desregistrar el adaptador.
      capturing = false;
      clearWatchdog();
      liveListener = null;
      decimate = null;
      endRecordingSession();

      // `stop()` vacía el buffer nativo pendiente, pero los bloques llegan por
      // el emisor de eventos, es decir, en un turno posterior del hilo JS.
      // Leyendo `chunks` de inmediato se perdía la cola de la emisión (hasta
      // un par de décimas), justo el tramo final que el clínico acaba de pedir
      // sostener. Un turno de espera basta para recogerla.
      await new Promise<void>(resolve => setTimeout(resolve, TAIL_DRAIN_MS));

      // Concatena el PCM decimado; el análisis se hace después, bajo demanda.
      const total = chunks.reduce((a, c) => a + c.length, 0);
      const pcm = new Float32Array(total);
      let off = 0;
      for (const c of chunks) {
        pcm.set(c, off);
        off += c.length;
      }
      chunks = [];
      return pcm;
    },

    analyse: analysePcm,

    hasSignal: () => blocksReceived > 0,

    play: (pcm: Float32Array, onEnded: () => void) => {
      stopPlayback();
      // Reproducir exige devolver la sesión a `playback`: si quedó una captura
      // a medias, en iOS `playAndRecord` atenúa la salida y la toma se oía
      // muy floja o no se oía.
      endRecordingSession();

      if (!playbackCtx) playbackCtx = acquireAudioContext();
      if (!playbackCtx) {
        onEnded();
        return;
      }
      resumeAudioContext();

      // Re-expansión ×3 (16 kHz → 48 kHz) por interpolación lineal para que la
      // toma suene a la frecuencia del contexto de reproducción.
      const up = new Float32Array(pcm.length * DECIMATE);
      for (let i = 0; i < pcm.length; i++) {
        const a = pcm[i];
        const b = i + 1 < pcm.length ? pcm[i + 1] : a;
        const base = i * DECIMATE;
        up[base] = a;
        up[base + 1] = a + (b - a) / 3;
        up[base + 2] = a + (2 * (b - a)) / 3;
      }

      const buffer = playbackCtx.createBuffer(1, up.length, CAPTURE_SR);
      try {
        buffer.copyToChannel(up, 0);
      } catch {
        buffer.getChannelData(0).set(up);
      }

      const source = playbackCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(playbackCtx.destination);
      source.onEnded = () => {
        if (playbackSource === source) playbackSource = null;
        onEnded();
      };
      playbackSource = source;
      source.start();
    },

    stopPlayback,
  };

  disposeCurrent = () => {
    stopPlayback();
    endRecordingSession();
    capturing = false;
    clearWatchdog();
    liveListener = null;
    try {
      recorder?.stop();
    } catch {
      /* noop */
    }
    // Única soltada de la referencia: el stream nativo se cierra cuando el GC
    // libera el host object. Por eso hay UN recorder por adaptador y no uno
    // por grabación (ver la nota de ciclo de vida).
    recorder = null;
    if (playbackCtx) {
      playbackCtx = null;
      releaseAudioContext();
    }
  };

  setVoiceMicAdapter(adapter);
  registered = true;
  return true;
}

/**
 * Quita el adaptador y libera lo que tuviera abierto (sesión de grabación y
 * referencia al contexto compartido). Se llama al desmontar la pantalla y en
 * los tests: sin esto la sesión podía quedarse en modo `playAndRecord` y
 * atenuar el audio del resto de módulos.
 */
export function unregisterVoiceMicAdapter(): void {
  disposeCurrent?.();
  disposeCurrent = null;
  setVoiceMicAdapter(null);
  registered = false;
}
