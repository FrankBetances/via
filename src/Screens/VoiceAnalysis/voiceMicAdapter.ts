import { PermissionsAndroid, Platform } from 'react-native';
import {
  AudioBufferSourceNode,
  AudioContext,
  AudioManager,
  AudioRecorder,
} from 'react-native-audio-api';

import type { VoiceFormants } from '@/Models/VoiceAnalysis/VoiceAnalysis';
import { setVoiceMicAdapter, VoiceLiveFrame, VoiceMicAdapter, VoiceMicResult } from './useVoiceAnalysis';

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
/*       - F0 por autocorrelación normalizada en 100–500 Hz                    */
/*       - HNR desde el pico de autocorrelación r: 10·log10(r/(1−r))           */
/*       - Formantes F1–F3 por LPC (Levinson-Durbin) + picos de la envolvente  */
/*     Solo se aceptan ventanas sonoras (RMS y periodicidad mínimos).          */
/*   · `play(pcm)` — reproducción de la toma vía AudioBufferSourceNode (el     */
/*     PCM de 16 kHz se re-expande ×3 a 48 kHz por interpolación lineal para   */
/*     coincidir con la frecuencia del contexto de reproducción).              */
/* -------------------------------------------------------------------------- */

const CAPTURE_SR = 48000; // frecuencia del recorder nativo
const DECIMATE = 3; // 48 kHz -> 16 kHz efectivos
const SAMPLE_RATE = CAPTURE_SR / DECIMATE; // 16000
const FRAME = 1024; // ~64 ms de análisis
const MIN_LAG = Math.floor(SAMPLE_RATE / 500); // 500 Hz
const MAX_LAG = Math.ceil(SAMPLE_RATE / 100); // 100 Hz
const MIN_RMS = 0.015; // umbral de sonoridad
const MIN_PEAK = 0.45; // umbral de periodicidad
const LPC_ORDER = 12; // adecuado para 16 kHz (fs/1000 - 4 … fs/1000 + 4)

/** F0 + fuerza de periodicidad de una ventana por autocorrelación normalizada. */
function analyseFrame(x: Float32Array): { f0: number; peak: number; rms: number } | null {
  let energy = 0;
  for (let i = 0; i < x.length; i++) energy += x[i] * x[i];
  const rms = Math.sqrt(energy / x.length);
  if (rms < MIN_RMS) return null;

  let bestLag = 0;
  let bestR = 0;
  for (let lag = MIN_LAG; lag <= MAX_LAG && lag < x.length; lag++) {
    let num = 0;
    let den = 0;
    for (let i = 0; i < x.length - lag; i++) {
      num += x[i] * x[i + lag];
      den += x[i] * x[i] + x[i + lag] * x[i + lag];
    }
    const r = den > 0 ? (2 * num) / den : 0;
    if (r > bestR) {
      bestR = r;
      bestLag = lag;
    }
  }
  if (bestLag === 0 || bestR < MIN_PEAK) return null;
  return { f0: SAMPLE_RATE / bestLag, peak: bestR, rms };
}

/* ----------------------------- formantes (LPC) ---------------------------- */

/** Coeficientes LPC por autocorrelación + Levinson-Durbin. */
function lpcCoefficients(x: Float32Array, order: number): number[] | null {
  // Pre-énfasis + ventana de Hamming (estándar para análisis de formantes).
  const n = x.length;
  const w = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const pre = x[i] - 0.97 * (i > 0 ? x[i - 1] : 0);
    w[i] = pre * (0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (n - 1)));
  }

  const r = new Float64Array(order + 1);
  for (let lag = 0; lag <= order; lag++) {
    let acc = 0;
    for (let i = 0; i < n - lag; i++) acc += w[i] * w[i + lag];
    r[lag] = acc;
  }
  if (r[0] === 0) return null;

  const a = new Float64Array(order + 1);
  a[0] = 1;
  let e = r[0];
  for (let m = 1; m <= order; m++) {
    let k = -r[m];
    for (let i = 1; i < m; i++) k -= a[i] * r[m - i];
    k /= e;
    a[m] = k;
    for (let i = 1; i <= m >> 1; i++) {
      const tmp = a[i] + k * a[m - i];
      a[m - i] += k * a[i];
      a[i] = tmp;
    }
    e *= 1 - k * k;
    if (e <= 0) return null;
  }
  return Array.from(a);
}

/** Picos de la envolvente LPC 1/|A(e^jω)| evaluada en 150–4000 Hz. */
function formantsFromLpc(a: number[]): number[] {
  const STEP = 10; // Hz
  const FMIN = 150;
  const FMAX = 4000;
  const mags: number[] = [];
  const freqs: number[] = [];
  for (let f = FMIN; f <= FMAX; f += STEP) {
    const w = (2 * Math.PI * f) / SAMPLE_RATE;
    let re = 0;
    let im = 0;
    for (let k = 0; k < a.length; k++) {
      re += a[k] * Math.cos(k * w);
      im -= a[k] * Math.sin(k * w);
    }
    const mag = 1 / Math.max(1e-9, Math.hypot(re, im));
    mags.push(mag);
    freqs.push(f);
  }
  const peaks: number[] = [];
  for (let i = 1; i < mags.length - 1; i++) {
    if (mags[i] > mags[i - 1] && mags[i] >= mags[i + 1]) peaks.push(freqs[i]);
  }
  return peaks;
}

const yieldToEventLoop = () => new Promise<void>(resolve => setTimeout(resolve, 0));

function median(values: number[]): number {
  const s = [...values].sort((x, y) => x - y);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Formantes F1–F3 medianos sobre las ventanas sonoras de la emisión.
 *  Asíncrono: cede el hilo JS cada pocas ventanas (LPC es lo más caro). */
async function estimateFormants(
  pcm: Float32Array,
  voicedOffsets: number[],
): Promise<VoiceFormants | null> {
  const f1s: number[] = [];
  const f2s: number[] = [];
  const f3s: number[] = [];
  let sinceYield = 0;
  for (const off of voicedOffsets) {
    const a = lpcCoefficients(pcm.subarray(off, off + FRAME), LPC_ORDER);
    if (a) {
      const peaks = formantsFromLpc(a);
      // Asignación por rangos plausibles de la vocal /a/ infantil.
      const f1 = peaks.find(f => f >= 300 && f <= 1200);
      const f2 = peaks.find(f => f1 !== undefined && f > f1 + 250 && f >= 800 && f <= 3000);
      const f3 = peaks.find(f => f2 !== undefined && f > f2 + 300 && f >= 1800 && f <= 4000);
      if (f1 !== undefined) f1s.push(f1);
      if (f2 !== undefined) f2s.push(f2);
      if (f3 !== undefined) f3s.push(f3);
    }
    if (++sinceYield >= 4) {
      sinceYield = 0;
      await yieldToEventLoop();
    }
  }
  if (f1s.length < 3 || f2s.length < 3) return null;
  return {
    f1: Math.round(median(f1s)),
    f2: Math.round(median(f2s)),
    f3: f3s.length >= 3 ? Math.round(median(f3s)) : Math.round(median(f2s) * 2),
  };
}

/* ----------------------------- análisis diferido --------------------------- */

/**
 * Análisis acústico completo de una toma. Cede el hilo JS cada pocas ventanas:
 * sobre 5 s de audio la autocorrelación + LPC tardan lo suyo y ejecutarlas de
 * una pieza congelaba la pantalla (el «cuelgue» que se veía al terminar de
 * grabar cuando esto corría dentro de `stopRecording`).
 */
async function analysePcm(pcm: Float32Array): Promise<VoiceMicResult> {
  const f0s: number[] = [];
  const amplitudes: number[] = [];
  const hnrs: number[] = [];
  const voicedOffsets: number[] = [];

  let sinceYield = 0;
  for (let i = 0; i + FRAME <= pcm.length; i += FRAME) {
    const frame = analyseFrame(pcm.subarray(i, i + FRAME));
    if (frame) {
      voicedOffsets.push(i);
      f0s.push(frame.f0);
      amplitudes.push(frame.rms);
      const r = Math.min(0.999, Math.max(0.001, frame.peak));
      hnrs.push(Math.max(0, Math.min(35, 10 * Math.log10(r / (1 - r)))));
    }
    if (++sinceYield >= 8) {
      sinceYield = 0;
      await yieldToEventLoop();
    }
  }

  // Formantes solo sobre una muestra de ventanas sonoras (coste acotado).
  const sampled = voicedOffsets.filter((_, idx) => idx % 3 === 0).slice(0, 20);
  const formants = await estimateFormants(pcm, sampled);

  return { f0s, amplitudes, hnrs, formants };
}

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
