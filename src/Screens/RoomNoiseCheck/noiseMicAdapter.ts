import { PermissionsAndroid, Platform } from 'react-native';
import { AudioManager, AudioRecorder } from 'react-native-audio-api';

import { clamp } from '@/Helpers/numeric';
import { NoiseMicAdapter, setNoiseMicAdapter } from './useNoiseMeter';

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
/*  Pipeline: bloques PCM mono de ~100 ms a 48 kHz → RMS → dBFS → dB SPL       */
/*  aproximados (mapeo relativo 28–92 dB, sin calibración absoluta) + 24       */
/*  bandas de energía temporal para el espectro de la UI.                      */
/*                                                                             */
/*  Permisos: Android `RECORD_AUDIO` (lo solicita el adaptador); iOS           */
/*  `NSMicrophoneUsageDescription` en Info.plist.                              */
/* -------------------------------------------------------------------------- */

const CAPTURE_SR = 48000;
const BUFFER_SAMPLES = Math.round(CAPTURE_SR * 0.1); // ~100 ms por bloque
const BANDS = 24;

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

/**
 * Registra el adaptador de micrófono real (idempotente; la pantalla lo llama
 * en su `useEffect` de montaje). Devuelve `true` si quedó registrado.
 */
export function registerNoiseMicAdapter(): boolean {
  if (registered) return true;

  let recorder: AudioRecorder | null = null;
  let lastDb: number | null = null;
  let lastLevels: number[] | null = null;

  const adapter: NoiseMicAdapter = {
    start: async () => {
      const granted = await ensureMicPermission();
      if (!granted) throw new Error('Permiso de micrófono denegado');

      // Sesión de grabación SOLO mientras dura la medición (en iOS
      // `playAndRecord` puede atenuar la salida; se restaura al parar).
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

      recorder = new AudioRecorder({
        sampleRate: CAPTURE_SR,
        bufferLengthInSamples: BUFFER_SAMPLES,
      });

      recorder.onAudioReady(({ buffer }) => {
        try {
          const pcm = buffer.getChannelData(0) as Float32Array;
          const n = pcm.length;
          if (!n) return;

          const bands = new Array(BANDS).fill(0);
          const seg = Math.max(1, Math.floor(n / BANDS));
          let sum = 0;
          for (let i = 0; i < n; i++) {
            const s = pcm[i];
            sum += s * s;
            const b = Math.min(BANDS - 1, Math.floor(i / seg));
            bands[b] += s * s;
          }
          const rms = Math.sqrt(sum / n);
          const dbfs = 20 * Math.log10(rms || 1e-7); // ~ -90..0
          lastDb = clamp(92 + dbfs, 28, 92); // dB SPL aprox. (relativo, mismo mapeo que el mockup)
          lastLevels = bands.map(e => Math.max(0.04, Math.min(1, Math.sqrt(e / seg) * 3.4)));
        } catch {
          /* un bloque corrupto no debe tumbar la medición */
        }
      });

      recorder.start();
    },
    stop: () => {
      try {
        recorder?.stop();
      } catch {
        /* noop */
      }
      recorder = null;
      lastDb = null;
      lastLevels = null;
      try {
        AudioManager.setAudioSessionOptions({
          iosCategory: 'playback',
          iosMode: 'default',
          iosOptions: ['defaultToSpeaker', 'allowBluetooth', 'allowBluetoothA2DP'],
        });
      } catch {
        /* sin AudioManager en este target */
      }
    },
    read: () => lastDb,
    spectrum: () => lastLevels ?? [],
  };

  setNoiseMicAdapter(adapter);
  registered = true;
  return true;
}

/** Quita el adaptador (p. ej. en tests). */
export function unregisterNoiseMicAdapter(): void {
  setNoiseMicAdapter(null);
  registered = false;
}
