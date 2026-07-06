import {
  AudioContext,
  AudioManager,
  OscillatorNode,
  GainNode,
  StereoPannerNode,
} from 'react-native-audio-api';
import { setAudiometryToneAdapter, ToneChannel, ToneTarget } from './useAudiometryTest';
import { dbHLtoGainFreeField } from './audiometryCalibration';

/* ==========================================================================
 * Adaptador de tono REAL para Audiometría Infantil / Condicionada (Android+iOS)
 * --------------------------------------------------------------------------
 * Biblioteca: react-native-audio-api (Software Mansion) — Web Audio API nativa
 * sobre **Oboe** en Android y AVAudioEngine en iOS. Es la única dependencia de
 * audio que sintetiza tonos puros calibrados en el dispositivo; `react-native-
 * sound` NO sirve aquí (solo reproduce ficheros, no genera osciladores).
 *
 *   yarn add react-native-audio-api
 *   cd ios && pod install
 *
 * Síntesis: OscillatorNode (seno) -> GainNode (nivel dB HL) -> StereoPannerNode
 * (OD = derecho, OI = izquierdo, CL = campo libre centrado) -> destination.
 * Rampa de 20 ms para
 * evitar clicks (imprescindible en audiometría). Los sonidos de control no
 * tonales ('amb' = sirena de ambulancia, 'tren' = silbato de tren con vibrato)
 * se generan modulados para condicionar la atención del niño.
 * ========================================================================== */

export interface ToneAdapterOptions {
  /** dB HL -> ganancia lineal. Por defecto se usa la calibración por frecuencia
   *  (RETSPL de campo libre, ISO 389-7) de `audiometryCalibration`, que corrige
   *  la RELACIÓN de nivel entre bandas. Sustituible por la tabla real medida
   *  contra equipo patrón por transductor si se dispone de ella. El nivel
   *  ABSOLUTO sigue siendo ORIENTATIVO (debe advertirse en UI/PDF). */
  dbHLtoGain?: (dbHL: number, freq: number) => number;
  /** Duración del tono puro (ms). El hook ya corta a 1400 ms por su cuenta. */
  toneDurationMs?: number;
}

// OD = derecha, OI = izquierda, CL = campo libre (centrado, ambos altavoces).
const panForChannel = (channel: ToneChannel): number =>
  channel === 'OD' ? 1 : channel === 'OI' ? -1 : 0;

/**
 * Registra el motor de tono real sobre react-native-audio-api y devuelve una
 * función de limpieza que lo desregistra y libera el AudioContext.
 *
 *   // App.tsx (una sola vez, al arrancar)
 *   import { installAudiometryToneAdapter } from '@/Screens/Audiometry';
 *   useEffect(() => installAudiometryToneAdapter(), []);
 */
export function installAudiometryToneAdapter(opts: ToneAdapterOptions = {}): () => void {
  const dbHLtoGain = opts.dbHLtoGain ?? dbHLtoGainFreeField;
  const toneDurationMs = opts.toneDurationMs ?? 1600;

  // Sesión de audio: reproducción a través del altavoz, permitiendo Bluetooth.
  try {
    AudioManager.setAudioSessionOptions({
      iosCategory: 'playback',
      iosMode: 'default',
      iosOptions: ['defaultToSpeaker', 'allowBluetooth', 'allowBluetoothA2DP'],
    });
    AudioManager.setAudioSessionActivity(true);
  } catch {
    /* algunos targets de desarrollo no exponen AudioManager: se ignora */
  }

  let ctx: AudioContext | null = new AudioContext({ sampleRate: 48000 });

  // Nodos activos del estímulo en curso (para poder detenerlos).
  let osc: OscillatorNode | null = null;
  let gain: GainNode | null = null;
  let panner: StereoPannerNode | null = null;
  let sirenTimer: ReturnType<typeof setInterval> | null = null;

  const stop = () => {
    if (sirenTimer) { clearInterval(sirenTimer); sirenTimer = null; }
    if (osc) { try { osc.stop(); } catch {} }
    try { osc?.disconnect(); gain?.disconnect(); panner?.disconnect(); } catch {}
    osc = null; gain = null; panner = null;
  };

  const buildChain = (channel: ToneChannel, level: number, now: number) => {
    if (!ctx) return null;
    gain = ctx.createGain();
    panner = ctx.createStereoPanner();
    panner.pan.value = panForChannel(channel);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(level, now + 0.02); // anti-click 20 ms
    gain.connect(panner);
    panner.connect(ctx.destination);
    return gain;
  };

  const playTone = (freq: ToneTarget, dbHL: number, channel: ToneChannel) => {
    if (!ctx) return;
    stop();
    // Si el sistema suspendió el contexto (interrupción, cambio de ruta de
    // audio, arranque en segundo plano), reactivarlo antes de programar el
    // estímulo: un contexto suspendido reproduce silencio sin dar error.
    try {
      if ((ctx as any).state && (ctx as any).state !== 'running') {
        void ctx.resume();
      }
    } catch {
      /* state/resume no disponibles en algunos targets: se ignora */
    }
    const now = ctx.currentTime;

    if (typeof freq === 'number') {
      // --- Tono puro calibrado -------------------------------------------
      const level = dbHLtoGain(dbHL, freq);
      const g = buildChain(channel, level, now);
      if (!g) return;
      osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      // rampa de salida para cerrar sin click
      const end = now + toneDurationMs / 1000;
      g.gain.setValueAtTime(level, end - 0.02);
      g.gain.linearRampToValueAtTime(0, end);
      osc.connect(g);
      osc.start(now);
      osc.stop(end);
    } else {
      // --- Sonido de control no tonal ------------------------------------
      // Nivel de control alto y fijo: solo condiciona la atención, no umbral.
      // 'amb' = sirena de ambulancia (dos tonos alternos).
      // 'tren' = silbato de tren (tono grave sostenido con vibrato lento).
      const g = buildChain(channel, 0.18, now);
      if (!g) return;
      osc = ctx.createOscillator();
      osc.type = freq === 'amb' ? 'square' : 'triangle';
      osc.frequency.value = freq === 'amb' ? 650 : 520;
      osc.connect(g);
      osc.start(now);
      let phase = 0;
      sirenTimer = setInterval(() => {
        if (!osc || !ctx) return;
        if (freq === 'amb') {
          phase = 1 - phase;
          osc.frequency.setValueAtTime(phase ? 900 : 650, ctx.currentTime);
        } else {
          phase += 0.35;
          osc.frequency.setValueAtTime(520 + 26 * Math.sin(phase), ctx.currentTime);
        }
      }, freq === 'amb' ? 420 : 90);
    }
  };

  setAudiometryToneAdapter({ playTone, stop });

  return () => {
    stop();
    setAudiometryToneAdapter(null);
    try { ctx?.close(); } catch {}
    ctx = null;
  };
}
