import { PermissionsAndroid, Platform } from 'react-native';
import { AudioManager, AudioRecorder } from 'react-native-audio-api';

import { acquireRecordingSession } from '@/Audio';
import { NoiseMicAdapter, setNoiseMicAdapter } from './useNoiseMeter';
import {
  aWeightMeanSquare,
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
/*  Pipeline: bloques PCM mono de ~100 ms a 48 kHz → PONDERACIÓN A (IEC 61672) */
/*  → energía media → promedio ENERGÉTICO (Leq, ver `noiseDsp`) → dB(A) SPL    */
/*  + espectro FFT real por bandas log (sin ponderar: el espectro muestra el   */
/*  contenido real). El Leq y la FFT sustituyen al RMS de un único bloque y a  */
/*  la envolvente temporal, que hacían que la lectura y el espectro «saltaran  */
/*  al azar»; la ponderación A corrige la lectura inflada por el retumbe de    */
/*  baja frecuencia (ver `noiseDsp` para la calibración).                       */
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
  let releaseSession: (() => void) | null = null;

  const teardownNative = () => {
    try {
      recorder?.stop();
    } catch {
      /* noop */
    }
    recorder = null;
    releaseSession?.();
    releaseSession = null;
  };

  const adapter: NoiseMicAdapter = {
    start: async () => {
      const granted = await ensureMicPermission();
      if (!granted) throw new Error('Permiso de micrófono denegado');

      // Un arranque nuevo no debe heredar el recorder de una medición previa
      // que quedase a medias: era la vía por la que el sonómetro se quedaba
      // «pillado» sin entregar bloques al reabrir la pantalla.
      teardownNative();

      // Estado limpio en cada arranque (no arrastrar energía de una medición previa).
      leqMs = null;
      bandsEma = null;
      lastDb = null;
      lastLevels = null;
      blocks = 0;

      // Sesión de grabación SOLO mientras dura la medición; la libera
      // `stop()` y, con ella, la sesión vuelve sola a reproducción.
      releaseSession = acquireRecordingSession();

      try {
        recorder = new AudioRecorder({
          sampleRate: CAPTURE_SR,
          bufferLengthInSamples: BUFFER_SAMPLES,
        });

        recorder.onAudioReady(({ buffer }) => {
          try {
            const pcm = buffer.getChannelData(0) as Float32Array;
            if (!pcm.length) return;
            blocks += 1;

            // Nivel: promedio ENERGÉTICO entre bloques (Leq) sobre la señal
            // PONDERADA A → dB(A) estable, en vez del RMS sin ponderar de un
            // único bloque de 100 ms (que salta varios dB por frame y además
            // sobreestima por el retumbe de baja frecuencia).
            leqMs = updateLeqMeanSquare(leqMs, aWeightMeanSquare(pcm, CAPTURE_SR), LEQ_ALPHA);
            lastDb = meanSquareToSpl(leqMs);

            // Espectro: FFT real por bandas log de frecuencia, suavizado.
            bandsEma = smoothBands(bandsEma, spectrumBands(pcm, CAPTURE_SR), SPECTRUM_ALPHA);
            lastLevels = bandsEma;
          } catch {
            /* un bloque corrupto no debe tumbar la medición */
          }
        });

        recorder.start();
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
      teardownNative();
      lastDb = null;
      lastLevels = null;
      leqMs = null;
      bandsEma = null;
      blocks = 0;
    },
    read: () => lastDb,
    spectrum: () => lastLevels ?? [],
    hasSignal: () => blocks > 0,
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
