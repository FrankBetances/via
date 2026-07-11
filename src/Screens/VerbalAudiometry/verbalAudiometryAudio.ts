import {
  AudioBuffer,
  AudioBufferSourceNode,
  AudioContext,
  AudioManager,
  GainNode,
  StereoPannerNode,
} from 'react-native-audio-api';

/* -------------------------------------------------------------------------- */
/*  Adaptador de audio de la Audiometría Verbal (campo libre, sin audífonos).  */
/*                                                                             */
/*  Reproduce la PALABRA objetivo por el altavoz, centrada en ambos canales    */
/*  (pan = 0, binaural — mismo criterio que el canal `CL` de la audiometría    */
/*  tonal). Dos motores con DEGRADACIÓN (principio VIA+):                      */
/*                                                                             */
/*   1. 'tts' — SINTETIZADOR NATIVO del sistema vía `react-native-tts`        */
/*      (Android: android.speech.tts.TextToSpeech con la voz es-ES del         */
/*      dispositivo — el motor por defecto del producto para el dictado).      */
/*      El nivel relativo SÍ se aplica: KEY_PARAM_VOLUME (0..1) recibe la      */
/*      misma ganancia `speechLevelToGain` que el motor de recortes y          */
/*      KEY_PARAM_PAN = 0 mantiene la presentación binaural centrada. Sigue    */
/*      sin calibración ABSOLUTA (la sonoridad base depende de la voz          */
/*      instalada): etiquetar como orientativo en UI/PDF.                      */
/*   2. 'assets' — recortes grabados (`assets/audio/verbal/<clave>.m4a`),      */
/*      decodificados con react-native-audio-api (decodeAudioDataSource) y     */
/*      reproducidos vía BufferSource → Gain → StereoPanner(0) → destination.  */
/*      Es la vía prevista para las locuciones de locutor profesional          */
/*      (validación clínica); si un recorte falta o no decodifica, degrada     */
/*      a TTS por palabra.                                                     */
/*                                                                             */
/*  Sin ninguno de los dos motores, la pantalla sigue operativa en modo        */
/*  demostración (el clínico presenta el modelo con su voz), igual que la      */
/*  audiometría tonal sin adaptador.                                           */
/*                                                                             */
/*  NIVEL (motor 'assets'): ganancia relativa anclando la voz conversacional   */
/*  (65 dB) al fondo de escala del altavoz — mismo compromiso que              */
/*  `SPEAKER_ANCHOR_DB_HL` en `audiometryCalibration.ts`. Presupone recortes   */
/*  normalizados a un RMS de referencia en producción. El nivel ABSOLUTO       */
/*  sigue siendo ORIENTATIVO y así debe advertirse.                            */
/* -------------------------------------------------------------------------- */

export type VerbalAudioEngine = 'assets' | 'tts';

export interface VerbalAudioAdapter {
  /** Reproduce la palabra objetivo al nivel indicado (dB, orientativo). */
  playWord: (audioKey: string, word: string, levelDb: number) => void;
  stop: () => void;
  /**
   * Motor activo. 'tts' = sintetizador nativo del sistema (nivel RELATIVO
   * aplicado por volumen de síntesis, sin calibración absoluta); 'assets' =
   * recortes grabados (vía prevista para locuciones de locutor).
   */
  engine: VerbalAudioEngine;
}

let audioAdapter: VerbalAudioAdapter | null = null;
export const setVerbalAudioAdapter = (a: VerbalAudioAdapter | null) => {
  audioAdapter = a;
};
export const getVerbalAudioAdapter = (): VerbalAudioAdapter | null => audioAdapter;

/** Voz conversacional (65 dB) anclada al fondo de escala del altavoz. */
export const SPEECH_ANCHOR_DB = 65;

/** dB de presentación → ganancia lineal (0..1), relativa al ancla de voz. */
export const speechLevelToGain = (levelDb: number): number =>
  Math.min(1, Math.pow(10, (levelDb - SPEECH_ANCHOR_DB) / 20));

/* Metro exige literales en `require(...)` (ver articulationAudio.ts). */
const optionalTts = (): any => {
  try {
    return require('react-native-tts');
  } catch (_e) {
    return null;
  }
};

export interface VerbalAudioAdapterOptions {
  /**
   * Motor preferido para el dictado. Por defecto 'tts' (sintetizador nativo
   * del sistema, decisión de producto: voz natural del dispositivo). Con
   * 'assets' se usan los recortes de `assetSource` (locuciones de locutor)
   * degradando a TTS palabra a palabra si un recorte falta o no decodifica.
   */
  engine?: VerbalAudioEngine;
  /**
   * Resuelve la clave de audio de una palabra (`assetKeyForWord`) a una ruta
   * local reproducible (file:// o ruta de bundle). Solo interviene con
   * `engine: 'assets'`; `null` = sin recorte para esa palabra → TTS.
   */
  assetSource?: (audioKey: string) => string | null;
  /** dB → ganancia (recortes y volumen TTS). Por defecto `speechLevelToGain`. */
  levelToGain?: (levelDb: number) => number;
}

/**
 * Registra el motor real de la audiometría verbal y devuelve la función de
 * limpieza que lo desregistra y libera el AudioContext.
 *
 *   // App.tsx (una sola vez, al arrancar; tras el adaptador de tonos)
 *   import { installVerbalAudioAdapter } from '@/Screens/VerbalAudiometry';
 *   useEffect(() => installVerbalAudioAdapter(), []);
 */
export function installVerbalAudioAdapter(opts: VerbalAudioAdapterOptions = {}): () => void {
  const levelToGain = opts.levelToGain ?? speechLevelToGain;
  const assetSource = opts.assetSource ?? null;
  // Motor por defecto: sintetizador nativo del sistema (dictado con la voz
  // es-ES del dispositivo). 'assets' queda para las locuciones de locutor.
  const engine: VerbalAudioEngine = opts.engine ?? 'tts';

  // Sesión de audio por altavoz (misma configuración que audiometryToneAdapter).
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
  const bufferCache = new Map<string, AudioBuffer>();

  // Nodos del estímulo en curso (para poder detenerlos).
  let source: AudioBufferSourceNode | null = null;
  let gain: GainNode | null = null;
  let panner: StereoPannerNode | null = null;

  const tts = optionalTts();
  const ttsEngine = tts?.default ?? tts;
  try {
    ttsEngine?.setDefaultLanguage?.('es-ES');
    // Ritmo pausado: presentación clínica de palabra aislada.
    ttsEngine?.setDefaultRate?.(0.4);
  } catch {
    /* noop */
  }

  const stop = () => {
    try { source?.stop(); } catch {}
    try { source?.disconnect(); } catch {}
    try { gain?.disconnect(); } catch {}
    try { panner?.disconnect(); } catch {}
    source = null; gain = null; panner = null;
    try { ttsEngine?.stop?.(); } catch {}
  };

  const speakWord = (word: string, levelDb: number) => {
    if (!ttsEngine) return; // sin motores: modo demostración
    try {
      ttsEngine.stop?.();
      // Sintetizador nativo (Android: TextToSpeech). El nivel relativo se
      // aplica con KEY_PARAM_VOLUME (misma ganancia que los recortes) y la
      // presentación binaural centrada con KEY_PARAM_PAN = 0, por el stream
      // de música (mismo canal de salida que el resto de estímulos).
      ttsEngine.speak?.(word, {
        androidParams: {
          KEY_PARAM_VOLUME: levelToGain(levelDb),
          KEY_PARAM_PAN: 0,
          KEY_PARAM_STREAM: 'STREAM_MUSIC',
        },
      });
    } catch {
      /* noop */
    }
  };

  const playBuffer = (buffer: AudioBuffer, levelDb: number) => {
    if (!ctx) return;
    // Reactivar el contexto si el sistema lo suspendió (ver audiometryToneAdapter).
    try {
      if ((ctx as any).state && (ctx as any).state !== 'running') void ctx.resume();
    } catch {
      /* state/resume no disponibles en algunos targets: se ignora */
    }
    const now = ctx.currentTime;
    source = ctx.createBufferSource();
    source.buffer = buffer;
    gain = ctx.createGain();
    panner = ctx.createStereoPanner();
    panner.pan.value = 0; // campo libre binaural: centrado en ambos altavoces
    const level = levelToGain(levelDb);
    // Rampas anti-click de 15 ms al inicio y al final del recorte.
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(level, now + 0.015);
    const end = now + buffer.duration;
    gain.gain.setValueAtTime(level, Math.max(now + 0.015, end - 0.015));
    gain.gain.linearRampToValueAtTime(0, end);
    source.connect(gain);
    gain.connect(panner);
    panner.connect(ctx.destination);
    source.start(now);
  };

  const playWord = (audioKey: string, word: string, levelDb: number) => {
    stop();
    // Motor 'tts' (por defecto): dictado directo con el sintetizador nativo.
    const path = engine === 'assets' ? assetSource?.(audioKey) ?? null : null;
    if (!path || !ctx) {
      speakWord(word, levelDb);
      return;
    }
    const cached = bufferCache.get(audioKey);
    if (cached) {
      playBuffer(cached, levelDb);
      return;
    }
    ctx
      .decodeAudioDataSource(path)
      .then(buffer => {
        bufferCache.set(audioKey, buffer);
        playBuffer(buffer, levelDb);
      })
      .catch(() => speakWord(word, levelDb)); // recorte ilegible → degradar a TTS
  };

  setVerbalAudioAdapter({
    playWord,
    stop,
    // Motor declarado. Con 'assets' la degradación por palabra (recorte
    // ausente/ilegible) se sigue haciendo en runtime.
    engine: engine === 'assets' && assetSource ? 'assets' : 'tts',
  });

  return () => {
    stop();
    setVerbalAudioAdapter(null);
    bufferCache.clear();
    try { ctx?.close(); } catch {}
    ctx = null;
  };
}
