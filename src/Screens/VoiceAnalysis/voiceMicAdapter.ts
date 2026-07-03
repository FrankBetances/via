import { setVoiceMicAdapter, VoiceMicAdapter, VoiceMicResult } from './useVoiceAnalysis';

/* -------------------------------------------------------------------------- */
/*  voiceMicAdapter — captura REAL del micrófono para el análisis acústico     */
/* -------------------------------------------------------------------------- */
/*  Misma filosofía de DEGRADACIÓN que el sonómetro (noiseMicAdapter): si la    */
/*  librería no está disponible o falta el permiso, NO se registra nada y la    */
/*  pantalla sigue en modo demostración.                                        */
/*                                                                              */
/*  Pipeline: `react-native-live-audio-stream` entrega PCM 16 bit mono a        */
/*  16 kHz; al detener la grabación se trocea en ventanas de 1024 muestras      */
/*  (~64 ms) y por ventana se calcula:                                          */
/*    · RMS (amplitud → shimmer aguas arriba)                                   */
/*    · F0 por autocorrelación normalizada en 100–500 Hz (rango vocal infantil) */
/*    · HNR estimado a partir del pico de autocorrelación r: 10·log10(r/(1−r))  */
/*  Solo se aceptan ventanas sonoras (RMS y pico de correlación mínimos).       */
/* -------------------------------------------------------------------------- */

const optionalRequire = (name: 'react-native-live-audio-stream' | 'buffer' | 'react-native'): any => {
  try {
    switch (name) {
      case 'react-native-live-audio-stream':
        return require('react-native-live-audio-stream');
      case 'buffer':
        return require('buffer');
      case 'react-native':
        return require('react-native');
    }
  } catch (_e) {
    return null;
  }
};

const SAMPLE_RATE = 16000;
const FRAME = 1024; // ~64 ms
const MIN_LAG = Math.floor(SAMPLE_RATE / 500); // 500 Hz
const MAX_LAG = Math.ceil(SAMPLE_RATE / 100); // 100 Hz
const MIN_RMS = 0.015; // umbral de sonoridad
const MIN_PEAK = 0.45; // umbral de periodicidad

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

let registered = false;

/**
 * Registra el adaptador de micrófono real para el análisis de voz
 * (idempotente; la pantalla lo llama en su `useEffect` de montaje).
 * Devuelve `true` si el motor de captura está disponible.
 */
export function registerVoiceMicAdapter(): boolean {
  if (registered) return true;

  const streamMod = optionalRequire('react-native-live-audio-stream');
  const LiveAudioStream = streamMod?.default ?? streamMod;
  const bufferMod = optionalRequire('buffer');
  const BufferImpl = bufferMod?.Buffer ?? (globalThis as any).Buffer;
  const rn = optionalRequire('react-native');

  if (!LiveAudioStream || !BufferImpl) return false;

  let chunks: Float32Array[] = [];
  let started = false;

  // audioSource 6 = VOICE_RECOGNITION (Android): sin AGC, señal más fiel.
  const options = { sampleRate: SAMPLE_RATE, channels: 1, bitsPerSample: 16, audioSource: 6, bufferSize: 4096 };

  const adapter: VoiceMicAdapter = {
    startRecording: async () => {
      if (rn?.Platform?.OS === 'android' && rn?.PermissionsAndroid) {
        const granted = await rn.PermissionsAndroid.request(rn.PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, {
          title: 'Permiso de micrófono',
          message: 'Se necesita el micrófono para grabar la voz del niño/a.',
          buttonPositive: 'Permitir',
        });
        if (granted !== rn.PermissionsAndroid.RESULTS.GRANTED) {
          throw new Error('RECORD_AUDIO denegado'); // → el hook cae a modo demo
        }
      }

      chunks = [];
      LiveAudioStream.init(options);
      LiveAudioStream.on('data', (b64: string) => {
        const buf = BufferImpl.from(b64, 'base64');
        const n = Math.floor(buf.length / 2);
        if (!n) return;
        const f = new Float32Array(n);
        for (let i = 0; i < n; i++) f[i] = buf.readInt16LE(i * 2) / 32768;
        chunks.push(f);
      });
      LiveAudioStream.start();
      started = true;
    },

    stopRecording: async (): Promise<VoiceMicResult> => {
      try {
        if (started) LiveAudioStream.stop();
      } catch (_e) {
        /* noop */
      }
      started = false;

      // Concatena el PCM y analiza por ventanas.
      const total = chunks.reduce((a, c) => a + c.length, 0);
      const pcm = new Float32Array(total);
      let off = 0;
      for (const c of chunks) {
        pcm.set(c, off);
        off += c.length;
      }
      chunks = [];

      const f0s: number[] = [];
      const amplitudes: number[] = [];
      const hnrs: number[] = [];
      for (let i = 0; i + FRAME <= pcm.length; i += FRAME) {
        const frame = analyseFrame(pcm.subarray(i, i + FRAME));
        if (!frame) continue;
        f0s.push(frame.f0);
        amplitudes.push(frame.rms);
        const r = Math.min(0.999, Math.max(0.001, frame.peak));
        hnrs.push(Math.max(0, Math.min(35, 10 * Math.log10(r / (1 - r)))));
      }
      return { f0s, amplitudes, hnrs };
    },
  };

  setVoiceMicAdapter(adapter);
  registered = true;
  return true;
}

/** Quita el adaptador y vuelve a modo demostración. */
export function unregisterVoiceMicAdapter(): void {
  setVoiceMicAdapter(null);
  registered = false;
}
