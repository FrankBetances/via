import { PermissionsAndroid, Platform } from 'react-native';
import { AudioManager, AudioRecorder } from 'react-native-audio-api';

import { NoiseMicAdapter, setNoiseMicAdapter } from './useNoiseMeter';
import {
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
/*  Pipeline: bloques PCM mono de ~100 ms a 48 kHz → energía media → promedio  */
/*  ENERGÉTICO (Leq, ver `noiseDsp`) → dB SPL orientativo (mapeo relativo      */
/*  28–92 dB, sin calibración absoluta) + espectro FFT real por bandas log.    */
/*  El Leq y la FFT sustituyen al RMS de un único bloque y a la envolvente     */
/*  temporal, que hacían que la lectura y el espectro «saltaran al azar».      */
/*                                                                             */
/*  Permisos: Android `RECORD_AUDIO` (lo solicita el adaptador); iOS           */
/*  `NSMicrophoneUsageDescription` en Info.plist.                              */
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

  const adapter: NoiseMicAdapter = {
    start: async () => {
      const granted = await ensureMicPermission();
      if (!granted) throw new Error('Permiso de micrófono denegado');

      // Estado limpio en cada arranque (no arrastrar energía de una medición previa).
      leqMs = null;
      bandsEma = null;
      lastDb = null;
      lastLevels = null;

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
          if (!pcm.length) return;

          // Nivel: promedio ENERGÉTICO entre bloques (Leq) → dB estable, en vez
          // del RMS de un único bloque de 100 ms (que salta varios dB por frame).
          leqMs = updateLeqMeanSquare(leqMs, meanSquare(pcm), LEQ_ALPHA);
          lastDb = meanSquareToSpl(leqMs);

          // Espectro: FFT real por bandas log de frecuencia, suavizado.
          bandsEma = smoothBands(bandsEma, spectrumBands(pcm, CAPTURE_SR), SPECTRUM_ALPHA);
          lastLevels = bandsEma;
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
      leqMs = null;
      bandsEma = null;
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
