import { Buffer } from 'buffer';
import {
  AudioBuffer,
  AudioBufferSourceNode,
  AudioContext,
  AudioManager,
  GainNode,
  StereoPannerNode,
} from 'react-native-audio-api';

import { pickBestSpanishVoice } from './verbalTtsVoice';

/* -------------------------------------------------------------------------- */
/*  Adaptador de audio de la Audiometría Verbal (campo libre, sin audífonos).  */
/*                                                                             */
/*  Reproduce la PALABRA objetivo por el altavoz, centrada en ambos canales    */
/*  (pan = 0, binaural — mismo criterio que el canal `CL` de la audiometría    */
/*  tonal). Dos motores con DEGRADACIÓN (principio VIA+):                      */
/*                                                                             */
/*   1. 'assets' (POR DEFECTO) — recortes es-ES empaquetados                   */
/*      (`assets/audio/verbal/<clave>.m4a`), decodificados con                 */
/*      react-native-audio-api y reproducidos vía BufferSource → Gain →        */
/*      StereoPanner(0) → destination. Castellano garantizado (no depende de   */
/*      las voces TTS del dispositivo); es también la vía de las locuciones    */
/*      de locutor profesional (validación clínica). Si un recorte falta o no  */
/*      decodifica, degrada a TTS por palabra.                                 */
/*   2. 'tts' — SINTETIZADOR NATIVO del sistema vía `react-native-tts`        */
/*      (Android: android.speech.tts.TextToSpeech). Solo dicta si hay una voz  */
/*      ESPAÑOLA verificada (setDefaultLanguage('es-ES') o una voz `es-*`      */
/*      instalada): dictar castellano con la voz en-US por defecto del         */
/*      sistema invalidaba el estímulo (bug reportado en campo). El nivel      */
/*      relativo SÍ se aplica: KEY_PARAM_VOLUME (0..1) recibe la misma         */
/*      ganancia `speechLevelToGain` que el motor de recortes y                */
/*      KEY_PARAM_PAN = 0 mantiene la presentación binaural centrada. Sigue    */
/*      sin calibración ABSOLUTA (la sonoridad base depende de la voz          */
/*      instalada): etiquetar como orientativo en UI/PDF.                      */
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
  /**
   * Dicta un TEXTO arbitrario (consignas de otros módulos, p. ej. los
   * mini-juegos de funciones ejecutivas) con el TTS es-ES VERIFICADO, a
   * volumen pleno. Silencioso si el dispositivo no tiene voz española: es
   * una ayuda de accesibilidad, no un estímulo clínico calibrado. Opcional
   * para no romper adaptadores de prueba ya registrados.
   */
  speakText?: (text: string) => void;
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
   * Motor preferido para el dictado. Por defecto 'assets': recortes es-ES
   * empaquetados (castellano GARANTIZADO, independiente de las voces TTS que
   * tenga el dispositivo), degradando a TTS palabra a palabra si un recorte
   * falta o no decodifica. 'tts' fuerza el sintetizador nativo (solo se usa
   * si hay una voz española verificada).
   */
  engine?: VerbalAudioEngine;
  /**
   * Resuelve la clave de audio de una palabra (`assetKeyForWord`) a una ruta
   * local reproducible (file:// o ruta de bundle). Solo interviene con
   * `engine: 'assets'`; `null` = sin recorte para esa palabra → TTS.
   */
  assetSource?: (audioKey: string) => string | null;
  /**
   * Recorte de la palabra INCRUSTADO en base64 (m4a). Vía PRIMARIA de
   * reproducción con `engine: 'assets'`: se decodifica en memoria, sin
   * depender de la ruta del asset (en desarrollo el asset es una URL de Metro
   * que la vía nativa por ruta no abre — por eso no sonaba en Android Studio).
   * Si falta, se cae a `assetSource` (ruta) y luego a TTS. `null` = sin recorte.
   */
  assetBase64?: (audioKey: string) => string | null;
  /** dB → ganancia (recortes y volumen TTS). Por defecto `speechLevelToGain`. */
  levelToGain?: (levelDb: number) => number;
  /**
   * Preferir el TTS NEURAL del dispositivo (la voz más humana) como vía
   * primaria cuando hay una voz española verificada, usando los recortes solo
   * como respaldo. Por defecto `true`: la voz nativa del sistema (p. ej. la
   * es-ES neural de Google/Apple) suena mucho más natural que los recortes
   * provisionales de espeak-ng. Con `false` se priorizan los recortes.
   */
  preferTts?: boolean;
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
  const assetBase64 = opts.assetBase64 ?? null;
  // Vía primaria: el TTS NEURAL del dispositivo (voz humana) SIEMPRE que haya
  // una voz española verificada; los recortes empaquetados quedan de respaldo
  // garantizado (offline / dispositivo sin voz española). Antes el TTS-primario
  // era inviable porque sin verificar la voz, Android dictaba en inglés; con la
  // selección/validación de voz (`pickBestSpanishVoice`) ya es seguro y suena
  // mucho más natural que los recortes provisionales de espeak-ng.
  const preferTts = opts.preferTts ?? true;
  const engine: VerbalAudioEngine = opts.engine ?? 'assets';

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
  // Selección de la MEJOR voz española del dispositivo (la más humana): se
  // enumeran las voces instaladas y se elige la neural es-ES de mayor calidad
  // (ver `pickBestSpanishVoice`), fijándola con `setDefaultVoice`. Solo si el
  // dispositivo no expone la lista se recurre a `setDefaultLanguage('es-ES')`.
  //
  // La VERIFICACIÓN de que existe voz española es imprescindible: sin ella el
  // motor quedaba con la voz por defecto del sistema (a menudo en-US) y las
  // palabras castellanas sonaban «en inglés» (bug de campo). Si no hay ninguna
  // voz española, el TTS se desactiva y se usan los recortes empaquetados.
  let ttsSpanishReady = false;
  const configureTts = async () => {
    if (!ttsEngine) return;
    try {
      await ttsEngine.getInitStatus?.();
      // Ritmo natural de palabra aislada: ni acelerado ni arrastrado (las voces
      // neurales suenan artificiales muy lentas; 0.48 mantiene naturalidad).
      try { await ttsEngine.setDefaultRate?.(0.48); } catch { /* opcional */ }
      try { await ttsEngine.setDefaultPitch?.(1.0); } catch { /* opcional */ }

      const voices = (await ttsEngine.voices?.()) ?? [];
      const best = pickBestSpanishVoice(voices);
      if (best?.id) {
        try {
          await ttsEngine.setDefaultVoice?.(best.id);
          ttsSpanishReady = true;
          return;
        } catch {
          /* la voz elegida no se pudo fijar: probamos por idioma */
        }
      }
      // Sin lista de voces (o sin poder fijarla): fijar el idioma castellano.
      try {
        await ttsEngine.setDefaultLanguage?.('es-ES');
        ttsSpanishReady = true;
      } catch {
        /* sin datos es-ES en el dispositivo: TTS desactivado → recortes */
      }
    } catch {
      /* motor TTS no inicializable: queda desactivado */
    }
  };
  void configureTts();

  const stop = () => {
    try { source?.stop(); } catch {}
    try { source?.disconnect(); } catch {}
    try { gain?.disconnect(); } catch {}
    try { panner?.disconnect(); } catch {}
    source = null; gain = null; panner = null;
    try { ttsEngine?.stop?.(); } catch {}
  };

  const speakWord = (word: string, levelDb: number) => {
    // Sin motor o sin voz española verificada: modo demostración (el clínico
    // presenta el modelo con su voz). Nunca dictar castellano con voz inglesa.
    if (!ttsEngine || !ttsSpanishReady) return;
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

  /**
   * Decodifica un recorte, en orden de fiabilidad:
   *   1. base64 incrustado → `decodeAudioData` EN MEMORIA (funciona idéntico
   *      en desarrollo y release, sin red ni sistema de ficheros);
   *   2. ruta local directa (`decodeAudioDataSource`), para recortes que
   *      lleguen como fichero (p. ej. locuciones de locutor externas);
   *   3. descarga + `decodeAudioData` (último recurso; el fetch de RN es poco
   *      fiable con binarios, por eso ya no es la vía principal).
   */
  const decodeClip = async (audioKey: string): Promise<AudioBuffer> => {
    if (!ctx) throw new Error('sin AudioContext');
    const b64 = assetBase64?.(audioKey) ?? null;
    if (b64) {
      const bytes = Buffer.from(b64, 'base64');
      const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      return await ctx.decodeAudioData(ab as ArrayBuffer);
    }
    const path = assetSource?.(audioKey) ?? null;
    if (!path) throw new Error('sin recorte para la palabra');
    try {
      return await ctx.decodeAudioDataSource(path);
    } catch (e) {
      const res = await fetch(path);
      const data = await res.arrayBuffer();
      if (!ctx) throw e;
      return await ctx.decodeAudioData(data);
    }
  };

  /** Dictado de consignas (frases completas) con el TTS es-ES verificado. */
  const speakText = (text: string) => {
    if (!ttsEngine || !ttsSpanishReady) return;
    try {
      ttsEngine.stop?.();
      ttsEngine.speak?.(text, {
        androidParams: {
          KEY_PARAM_VOLUME: 1,
          KEY_PARAM_PAN: 0,
          KEY_PARAM_STREAM: 'STREAM_MUSIC',
        },
      });
    } catch {
      /* noop */
    }
  };

  const playWord = (audioKey: string, word: string, levelDb: number) => {
    stop();
    const hasClip =
      engine === 'assets' && (!!assetBase64?.(audioKey) || !!assetSource?.(audioKey));

    // Vía PRIMARIA: TTS neural del dispositivo (voz humana) cuando hay voz
    // española verificada. Si además hay recorte, éste queda de respaldo por
    // si el TTS fallara (pero la voz nativa es el objetivo de calidad).
    if (preferTts && ttsSpanishReady) {
      speakWord(word, levelDb);
      return;
    }

    // Sin TTS español utilizable: recortes empaquetados (castellano garantizado).
    if (!hasClip || !ctx) {
      speakWord(word, levelDb); // último recurso (silencioso si no hay voz es)
      return;
    }
    const cached = bufferCache.get(audioKey);
    if (cached) {
      playBuffer(cached, levelDb);
      return;
    }
    decodeClip(audioKey)
      .then(buffer => {
        bufferCache.set(audioKey, buffer);
        playBuffer(buffer, levelDb);
      })
      .catch(() => speakWord(word, levelDb)); // recorte ilegible → degradar a TTS
  };

  setVerbalAudioAdapter({
    playWord,
    speakText,
    stop,
    // Motor declarado: 'tts' cuando se prefiere la voz nativa (el objetivo de
    // calidad); 'assets' si se priorizan los recortes. La degradación real por
    // palabra (voz no disponible → recorte, o recorte ilegible → voz) ocurre en
    // runtime en `playWord`.
    engine: preferTts ? 'tts' : engine === 'assets' && (assetBase64 || assetSource) ? 'assets' : 'tts',
  });

  return () => {
    stop();
    setVerbalAudioAdapter(null);
    bufferCache.clear();
    try { ctx?.close(); } catch {}
    ctx = null;
  };
}
