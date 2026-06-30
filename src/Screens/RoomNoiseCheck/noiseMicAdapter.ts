import { NoiseMicAdapter, setNoiseMicAdapter } from './useNoiseMeter';
import { clamp } from '@/Helpers/numeric';

/* -------------------------------------------------------------------------- */
/*  noiseMicAdapter — captura REAL del micrófono para el sonómetro             */
/* -------------------------------------------------------------------------- */
/*  Registra un adaptador de micrófono real basado en                          */
/*  `react-native-live-audio-stream`. Sigue el principio de DEGRADACIÓN de      */
/*  VIA+: si la librería no está instalada o falta el permiso, NO se registra   */
/*  nada y `useNoiseMeter` se queda en modo demostración (señal simulada), con  */
/*  toda la UI/veredicto/gating operativos igualmente.                          */
/*                                                                              */
/*  Dependencias (opcionales, resueltas en runtime):                            */
/*   - `react-native-live-audio-stream` → stream PCM del micrófono.            */
/*   - `buffer`                          → decodifica el PCM base64.            */
/*                                                                              */
/*   yarn add react-native-live-audio-stream buffer                            */
/*   cd ios && pod install                                                      */
/*                                                                              */
/*  Permisos: Android `RECORD_AUDIO` (lo solicita el adaptador); iOS           */
/*  `NSMicrophoneUsageDescription` en Info.plist.                              */
/* -------------------------------------------------------------------------- */

/* Metro exige literales en `require(...)` para poder empaquetar el módulo: un
 * nombre de variable (`require(name)`) rompe el build de producción aunque la
 * librería esté instalada. Por eso cada caso usa su propio `require` literal. */
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

/* ───────────────────────────────────────────────────────────────────────────
 * ACTIVAR MICRÓFONO REAL (recomendado para producción)
 * Por defecto se resuelve con `require` opcional (envuelto en try/catch): el
 * build NO se rompe si las librerías no están instaladas y el sonómetro
 * funciona en modo demostración.
 * Para integrar el micrófono real:
 *   1) yarn add react-native-live-audio-stream buffer   (cd ios && pod install)
 *   2) descomenta las 2 líneas `import` y las 2 asignaciones de abajo.
 * El import LITERAL garantiza que Metro EMPAQUETE los módulos (un require
 * dinámico podría no incluirlos en el bundle aunque estén instalados).
 * ─────────────────────────────────────────────────────────────────────────── */
// import LiveAudioStreamLib from 'react-native-live-audio-stream';
// import { Buffer as NodeBufferLib } from 'buffer';
let LIVE_AUDIO_STREAM: any = null;
let NODE_BUFFER: any = null;
// LIVE_AUDIO_STREAM = LiveAudioStreamLib;
// NODE_BUFFER = NodeBufferLib;

let registered = false;

/**
 * Registra el adaptador de micrófono real (idempotente). Llámalo una vez —la
 * pantalla ya lo hace en su `useEffect` de montaje—. Devuelve `true` si el motor
 * de captura está disponible; `false` si no (el hook seguirá en modo demo).
 */
export function registerNoiseMicAdapter(): boolean {
  if (registered) return true;

  const streamMod = LIVE_AUDIO_STREAM ?? optionalRequire('react-native-live-audio-stream');
  const LiveAudioStream = streamMod?.default ?? streamMod;
  const bufferMod = optionalRequire('buffer');
  const BufferImpl = NODE_BUFFER ?? bufferMod?.Buffer ?? (globalThis as any).Buffer;
  const rn = optionalRequire('react-native');

  if (!LiveAudioStream || !BufferImpl) return false;

  let lastDb: number | null = null;
  let lastLevels: number[] | null = null;
  let started = false;

  // audioSource 6 = VOICE_RECOGNITION (Android): sin AGC/efectos, ideal para medir.
  const options = { sampleRate: 16000, channels: 1, bitsPerSample: 16, audioSource: 6, bufferSize: 4096 };

  const adapter: NoiseMicAdapter = {
    start: async () => {
      // Permiso de micrófono (Android). En iOS lo solicita el SO al primer uso.
      if (rn?.Platform?.OS === 'android' && rn?.PermissionsAndroid) {
        const granted = await rn.PermissionsAndroid.request(rn.PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, {
          title: 'Permiso de micrófono',
          message: 'Se necesita el micrófono para medir el ruido ambiente de la sala.',
          buttonPositive: 'Permitir',
        });
        if (granted !== rn.PermissionsAndroid.RESULTS.GRANTED) {
          throw new Error('RECORD_AUDIO denegado'); // → el hook cae a modo demo
        }
      }

      LiveAudioStream.init(options);
      LiveAudioStream.on('data', (b64: string) => {
        const buf = BufferImpl.from(b64, 'base64');
        const n = Math.floor(buf.length / 2);
        if (!n) return;

        const BANDS = 24;
        const bands = new Array(BANDS).fill(0);
        const seg = Math.max(1, Math.floor(n / BANDS));
        let sum = 0;
        for (let i = 0; i < n; i++) {
          const s = buf.readInt16LE(i * 2) / 32768; // -1..1
          sum += s * s;
          const b = Math.min(BANDS - 1, Math.floor(i / seg));
          bands[b] += s * s;
        }
        const rms = Math.sqrt(sum / n);
        const dbfs = 20 * Math.log10(rms || 1e-7); // ~ -90..0
        lastDb = clamp(92 + dbfs, 28, 92); // dB SPL aprox. (relativo, mismo mapeo que el mockup)
        lastLevels = bands.map(e => Math.max(0.04, Math.min(1, Math.sqrt(e / seg) * 3.4)));
      });
      LiveAudioStream.start();
      started = true;
    },
    stop: () => {
      try {
        if (started) LiveAudioStream.stop();
      } catch (_e) {
        /* noop */
      }
      started = false;
      lastDb = null;
      lastLevels = null;
    },
    read: () => lastDb,
    spectrum: () => lastLevels ?? [],
  };

  setNoiseMicAdapter(adapter);
  registered = true;
  return true;
}

/** Quita el adaptador y vuelve a modo demostración. */
export function unregisterNoiseMicAdapter(): void {
  setNoiseMicAdapter(null);
  registered = false;
}
