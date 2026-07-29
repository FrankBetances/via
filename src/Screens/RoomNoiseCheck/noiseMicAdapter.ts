import { PermissionsAndroid, Platform } from 'react-native';
import { AudioManager, AudioRecorder } from 'react-native-audio-api';

import { acquireRecordingSession } from '@/Audio';
import { NoiseMicAdapter, setNoiseMicAdapter } from './useNoiseMeter';
import {
  createNoiseWeightingChain,
  isBlockClipped,
  meanSquare,
  meanSquareToSpl,
  smoothBands,
  spectrumBands,
  updateLeqMeanSquare,
} from './noiseDsp';

/* -------------------------------------------------------------------------- */
/*  noiseMicAdapter — captura REAL del micrófono para el sonómetro             */
/* -------------------------------------------------------------------------- */
/*  Motor: `react-native-audio-api` (AudioRecorder, Oboe/AVAudioEngine), el    */
/*  mismo paquete nativo que sintetiza los tonos de las audiometrías y graba   */
/*  el análisis acústico de voz. El adaptador anterior usaba                   */
/*  `react-native-live-audio-stream` (módulo del puente antiguo) que bajo la   */
/*  nueva arquitectura de RN 0.80 no entrega audio: el sonómetro quedaba       */
/*  atrapado en modo demostración con datos simulados.                         */
/*                                                                             */
/*  Pipeline: bloques PCM mono de ~100 ms a 48 kHz → bloqueo de DC +           */
/*  PONDERACIÓN A (IEC 61672) con ESTADO CONTINUO entre bloques → energía      */
/*  media → promedio ENERGÉTICO (Leq, ver `noiseDsp`) → dB(A) SPL + espectro   */
/*  FFT real por bandas log (sin ponderar: el espectro muestra el contenido    */
/*  real).                                                                     */
/*                                                                             */
/*  Tres decisiones que corrigen la lectura «entre 15 y 20 dB por encima, a    */
/*  veces 40, muy al azar»:                                                    */
/*   1. El filtro de ponderación conserva su estado entre bloques              */
/*      (`createNoiseWeightingChain`). Reiniciarlo en cada bloque —lo que se   */
/*      hacía antes— inyectaba el transitorio de los polos de 20.6 Hz cien     */
/*      veces por segundo: un sesgo grande y dependiente del contenido grave,  */
/*      o sea, alto y errático (ver cabecera de `noiseDsp`).                   */
/*   2. Se DESCARTAN los bloques de calentamiento (`WARMUP_MS`): el arranque   */
/*      del stream nativo, el asentamiento del filtro y la ganancia inicial    */
/*      del micrófono no son ruido de la sala.                                 */
/*   3. Se descartan los bloques SATURADOS: un golpe en el dispositivo recorta */
/*      la señal y su nivel real es desconocido; promediarlo disparaba la      */
/*      lectura decenas de dB de forma impredecible.                           */
/*                                                                             */
/*  Permisos: Android `RECORD_AUDIO` (lo solicita el adaptador); iOS           */
/*  `NSMicrophoneUsageDescription` en Info.plist.                              */
/*                                                                             */
/*  La sesión de audio la gobierna `@/Audio` (`acquireRecordingSession`): el   */
/*  adaptador NO la reconfigura por su cuenta, para no dejarla en modo         */
/*  grabación —con la salida atenuada en iOS— si la pantalla se cierra a       */
/*  mitad de una medición.                                                      */
/* -------------------------------------------------------------------------- */

const CAPTURE_SR = 48000;
const BUFFER_SAMPLES = Math.round(CAPTURE_SR * 0.1); // ~100 ms por bloque
/** Peso del bloque nuevo en el promedio energético (Leq). ~100 ms/bloque →
 *  constante de tiempo ≈0.8 s (respuesta «slow» estable de un sonómetro). */
const LEQ_ALPHA = 0.12;
/** Suavizado del espectro entre frames (barras estables, sin parpadeo). */
const SPECTRUM_ALPHA = 0.5;
/** Bloques iniciales que se descartan (arranque del stream + asentamiento del
 *  filtro de ponderación). 100 ms/bloque → 400 ms de calentamiento. */
const WARMUP_BLOCKS = 4;
/** Tope del historial de niveles por bloque (≈60 s a 100 ms/bloque): acota la
 *  memoria si la pantalla se deja abierta mucho rato. */
const MAX_BLOCK_HISTORY = 600;

async function ensureMicPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, {
      title: 'Permiso de micrófono',
      message: 'Se necesita el micrófono para medir el ruido ambiente de la sala.',
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

let registered = false;
/** Limpieza del adaptador vivo (recursos nativos del registro en curso). */
let disposeCurrent: (() => void) | null = null;

/**
 * Registra el adaptador de micrófono real (idempotente; la pantalla lo llama
 * en su `useEffect` de montaje). Devuelve `true` si quedó registrado.
 */
export function registerNoiseMicAdapter(): boolean {
  if (registered) return true;

  let recorder: AudioRecorder | null = null;
  let lastDb: number | null = null;
  let lastLevels: number[] | null = null;
  // Energía acumulada del Leq y espectro suavizado (persisten entre bloques).
  let leqMs: number | null = null;
  let bandsEma: number[] | null = null;
  /** Bloques recibidos desde el último arranque (detecta un stream mudo). */
  let blocks = 0;
  /** Bloques descartados por saturación (diagnóstico de manejo del equipo). */
  let clipped = 0;
  /** dB(A) de cada bloque VÁLIDO, sin suavizar, pendientes de consumir por el
   *  hook (que calcula LAeq y percentiles sobre ellos). */
  let pendingBlockDb: number[] = [];
  /** Cadena de medición con estado (se reinicia en cada `start`). */
  const chain = createNoiseWeightingChain(CAPTURE_SR);
  let releaseSession: (() => void) | null = null;

  /** ¿Está la medición activa? (el stream vive entre mediciones). */
  let capturing = false;

  /** Detiene la medición conservando el recorder para la siguiente. */
  const pauseCapture = () => {
    capturing = false;
    try {
      recorder?.stop();
    } catch {
      /* noop */
    }
    releaseSession?.();
    releaseSession = null;
  };

  /** Cierra del todo (solo al desregistrar el adaptador). */
  const teardownNative = () => {
    pauseCapture();
    recorder = null;
  };

  /**
   * Recorder ÚNICO del adaptador, creado y suscrito una sola vez.
   *
   * `AudioRecorder` de react-native-audio-api 0.8 abre el stream nativo en el
   * CONSTRUCTOR y no expone `close()`: solo se cierra cuando el GC libera el
   * host object. Construir uno por medición dejaba streams de entrada abiertos
   * a la espera del recolector y, cuando la apertura del siguiente fallaba, el
   * constructor nativo se lo tragaba (ignora el `Result` de `openStream`) y
   * `start()` no hacía nada ni lanzaba: el sonómetro se quedaba mudo sin ningún
   * error. Además cada `onAudioReady()` deja una suscripción viva y solo la
   * última queda conectada.
   */
  const ensureRecorder = (): AudioRecorder => {
    if (recorder) return recorder;

    const created = new AudioRecorder({
      sampleRate: CAPTURE_SR,
      bufferLengthInSamples: BUFFER_SAMPLES,
    });

    created.onAudioReady(({ buffer }) => {
      if (!capturing) return; // stream vivo pero sin medición en curso
      try {
        const pcm = buffer.getChannelData(0) as Float32Array;
        if (!pcm.length) return;
        blocks += 1;

        // El filtro SÍ consume el bloque de calentamiento (necesita esas
        // muestras para asentarse), pero su salida no se mide.
        const weighted = chain.process(pcm);
        if (blocks <= WARMUP_BLOCKS) return;

        // Bloque saturado: nivel real desconocido, no entra en la medición.
        if (isBlockClipped(pcm)) {
          clipped += 1;
          return;
        }

        // Nivel: promedio ENERGÉTICO entre bloques (Leq) sobre la señal
        // PONDERADA A → dB(A) estable, en vez del RMS sin ponderar de un
        // único bloque de 100 ms (que salta varios dB por frame y además
        // sobreestima por el retumbe de baja frecuencia).
        const blockMs = meanSquare(weighted);
        leqMs = updateLeqMeanSquare(leqMs, blockMs, LEQ_ALPHA);
        lastDb = meanSquareToSpl(leqMs);

        // Nivel SIN suavizar del bloque, para la estadística de la medición
        // (LAeq y percentiles): un percentil sobre la señal ya promediada
        // no distingue el fondo de la sala de sus picos.
        pendingBlockDb.push(meanSquareToSpl(blockMs));
        if (pendingBlockDb.length > MAX_BLOCK_HISTORY) {
          pendingBlockDb.splice(0, pendingBlockDb.length - MAX_BLOCK_HISTORY);
        }

        // Espectro: FFT real por bandas log de frecuencia, suavizado.
        bandsEma = smoothBands(bandsEma, spectrumBands(pcm, CAPTURE_SR), SPECTRUM_ALPHA);
        lastLevels = bandsEma;
      } catch {
        /* un bloque corrupto no debe tumbar la medición */
      }
    });

    recorder = created;
    return created;
  };

  const adapter: NoiseMicAdapter = {
    start: async () => {
      const granted = await ensureMicPermission();
      if (!granted) throw new Error('Permiso de micrófono denegado');

      // Una medición nueva no arrastra el estado de la anterior; el stream
      // nativo SÍ se reutiliza (ver `ensureRecorder`).
      pauseCapture();

      // Estado limpio en cada arranque (no arrastrar energía de una medición previa).
      leqMs = null;
      bandsEma = null;
      lastDb = null;
      lastLevels = null;
      blocks = 0;
      clipped = 0;
      pendingBlockDb = [];
      chain.reset();

      // Sesión de grabación SOLO mientras dura la medición; la libera
      // `stop()` y, con ella, la sesión vuelve sola a reproducción.
      releaseSession = acquireRecordingSession();

      try {
        // Se crea con el permiso ya concedido: el stream se abre en el
        // constructor del recorder.
        const active = ensureRecorder();
        capturing = true;
        active.start();
      } catch (e) {
        // El motor nativo no pudo abrir la entrada: se informa en vez de dejar
        // la pantalla midiendo un stream que nunca entregará muestras.
        teardownNative();
        throw e instanceof Error
          ? e
          : new Error('No se pudo abrir el micrófono. Ciérrelo en otras aplicaciones y reintente.');
      }
    },
    stop: () => {
      pauseCapture();
      lastDb = null;
      lastLevels = null;
      leqMs = null;
      bandsEma = null;
      blocks = 0;
      clipped = 0;
      pendingBlockDb = [];
      chain.reset();
    },
    read: () => lastDb,
    spectrum: () => lastLevels ?? [],
    hasSignal: () => blocks > WARMUP_BLOCKS,
    takeBlockLevels: () => {
      const out = pendingBlockDb;
      pendingBlockDb = [];
      return out;
    },
    clippedBlocks: () => clipped,
  };

  disposeCurrent = teardownNative;
  setNoiseMicAdapter(adapter);
  registered = true;
  return true;
}

/**
 * Quita el adaptador y libera los recursos nativos (recorder abierto y sesión
 * de grabación reservada). Sin esta limpieza, salir de la pantalla a mitad de
 * una medición dejaba la sesión en `playAndRecord` y el resto de módulos
 * sonaba atenuado.
 */
export function unregisterNoiseMicAdapter(): void {
  disposeCurrent?.();
  disposeCurrent = null;
  setNoiseMicAdapter(null);
  registered = false;
}
