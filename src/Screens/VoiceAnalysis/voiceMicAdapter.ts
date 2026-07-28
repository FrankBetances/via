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

  let recorder: AudioRecorder | null = null;
  let chunks: Float32Array[] = [];
  let decimate: ((raw: Float32Array) => Float32Array) | null = null;
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

  const adapter: VoiceMicAdapter = {
    sampleRate: SAMPLE_RATE,

    startRecording: async (onLive?: (frame: VoiceLiveFrame) => void) => {
      const granted = await ensureMicPermission();
      if (!granted) throw new Error('Permiso de micrófono denegado');

      stopPlayback();
      endRecordingSession();
      releaseSession = acquireRecordingSession();

      chunks = [];
      decimate = createDecimator3();
      recorder = new AudioRecorder({
        sampleRate: CAPTURE_SR,
        bufferLengthInSamples: Math.round(CAPTURE_SR * 0.1), // ~100 ms
      });

      recorder.onAudioReady(({ buffer }) => {
        try {
          const raw = buffer.getChannelData(0) as Float32Array;
          // Decimación ×3 con anti-alias → 16 kHz efectivos para el análisis.
          const ds = decimate ? decimate(raw) : new Float32Array(0);
          if (!ds.length) return;
          chunks.push(ds);

          if (onLive) {
            const win = ds.length >= FRAME ? ds.subarray(ds.length - FRAME) : ds;
            let sum = 0;
            for (let i = 0; i < win.length; i++) sum += win[i] * win[i];
            const rms = Math.sqrt(sum / (win.length || 1));
            const frame = win.length >= FRAME ? analyseFrame(win as Float32Array) : null;
            onLive({ f0: frame ? frame.f0 : null, rms });
          }
        } catch {
          /* un bloque corrupto no debe tumbar la captura */
        }
      });

      recorder.start();
    },

    stopRecording: async (): Promise<Float32Array> => {
      try {
        recorder?.stop();
      } catch {
        /* noop */
      }
      recorder = null;
      decimate = null;
      endRecordingSession();

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
    try {
      recorder?.stop();
    } catch {
      /* noop */
    }
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
