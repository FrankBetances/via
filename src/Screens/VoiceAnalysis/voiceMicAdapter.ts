import { PermissionsAndroid, Platform } from 'react-native';
import {
  AudioBufferSourceNode,
  AudioContext,
  AudioManager,
  AudioRecorder,
} from 'react-native-audio-api';

import { setVoiceMicAdapter, VoiceLiveFrame, VoiceMicAdapter } from './useVoiceAnalysis';
import { analyseFrame, analysePcm, FRAME, SAMPLE_RATE } from './voiceDsp';

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
// hasta la frecuencia efectiva del DSP (`SAMPLE_RATE` = 16 kHz).
const DECIMATE = 3;
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

/* ------------------------------ sesión de audio ---------------------------- */

function setSessionForRecording() {
  // Sesión de grabación SOLO mientras dura la captura (en iOS `playAndRecord`
  // puede atenuar la salida; se restaura al parar).
  try {
    AudioManager.setAudioSessionOptions({
      iosCategory: 'playAndRecord',
      iosMode: 'measurement',
      iosOptions: ['defaultToSpeaker', 'allowBluetooth'],
    });
    void AudioManager.setAudioSessionActivity(true);
  } catch {
    /* sin AudioManager en este target */
  }
}

function setSessionForPlayback() {
  try {
    AudioManager.setAudioSessionOptions({
      iosCategory: 'playback',
      iosMode: 'default',
      iosOptions: ['defaultToSpeaker', 'allowBluetooth', 'allowBluetoothA2DP'],
    });
  } catch {
    /* sin AudioManager en este target */
  }
}

/* ------------------------------- adaptador -------------------------------- */

let registered = false;

/**
 * Registra el adaptador de micrófono real (idempotente; la pantalla lo llama
 * en su `useEffect` de montaje). Devuelve `true` si el motor está disponible.
 */
export function registerVoiceMicAdapter(): boolean {
  if (registered) return true;

  let recorder: AudioRecorder | null = null;
  let chunks: Float32Array[] = [];
  let playbackCtx: AudioContext | null = null;
  let playbackSource: AudioBufferSourceNode | null = null;

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
      setSessionForRecording();

      chunks = [];
      recorder = new AudioRecorder({
        sampleRate: CAPTURE_SR,
        bufferLengthInSamples: Math.round(CAPTURE_SR * 0.1), // ~100 ms
      });

      recorder.onAudioReady(({ buffer }) => {
        try {
          const raw = buffer.getChannelData(0) as Float32Array;
          // Decimación ×3 → 16 kHz efectivos para el análisis.
          const n = Math.floor(raw.length / DECIMATE);
          if (!n) return;
          const ds = new Float32Array(n);
          for (let i = 0; i < n; i++) ds[i] = raw[i * DECIMATE];
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
      setSessionForPlayback();

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
      setSessionForPlayback();
      try {
        AudioManager.setAudioSessionActivity(true);
      } catch {
        /* sin AudioManager en este target */
      }

      if (!playbackCtx) playbackCtx = new AudioContext({ sampleRate: CAPTURE_SR });
      try {
        if (playbackCtx.state !== 'running') void playbackCtx.resume();
      } catch {
        /* state/resume no disponibles en algunos targets */
      }

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

  setVoiceMicAdapter(adapter);
  registered = true;
  return true;
}

/** Quita el adaptador (p. ej. en tests). */
export function unregisterVoiceMicAdapter(): void {
  setVoiceMicAdapter(null);
  registered = false;
}
