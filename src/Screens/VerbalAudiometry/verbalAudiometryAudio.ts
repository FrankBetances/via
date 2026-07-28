import { Buffer } from 'buffer';
import type {
  AudioBuffer,
  AudioBufferSourceNode,
  GainNode,
  StereoPannerNode,
} from 'react-native-audio-api';

import { acquireAudioContext, releaseAudioContext, resumeAudioContext } from '@/Audio';
import { pickVoiceForLang, ttsLanguageTagFor, type TtsVoice } from './verbalTtsVoice';

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
/*      instalada): etiquetar como orientativo en UI/PDF. Si un dictado FALLA  */
/*      en runtime (rechazo de `speak()` o evento `tts-error` — p. ej. voz de  */
/*      red sin conectividad), la palabra degrada a su recorte y, tras varios  */
/*      fallos seguidos, toda la sesión pasa a recortes (estímulo constante).  */
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
  /**
   * Reproduce la palabra objetivo al nivel indicado (dB, orientativo).
   * `lang` es el idioma/variante de la sesión (`es` por defecto): las
   * VARIANTES (es-DO) usan SIEMPRE sus recortes empaquetados como vía
   * primaria — son el estímulo validado por el logopeda de la variante — y
   * nunca el TTS del dispositivo como primario (impondría otro acento).
   */
  playWord: (audioKey: string, word: string, levelDb: number, lang?: string) => void;
  /**
   * Dicta un TEXTO arbitrario (consignas de otros módulos, p. ej. los
   * mini-juegos de funciones ejecutivas) con la voz VERIFICADA de `lang`, a
   * volumen pleno. Silencioso si el dispositivo no tiene voz utilizable: es
   * una ayuda de accesibilidad, no un estímulo clínico calibrado. Opcional
   * para no romper adaptadores de prueba ya registrados.
   */
  speakText?: (text: string, lang?: string) => void;
  /**
   * ¿Hay una voz del sistema VERIFICADA para dictar texto? `speakText` existe
   * siempre, pero es SILENCIOSO si el dispositivo no tiene voz española: la UI
   * necesita este dato para no ofrecer un botón de altavoz que no suena.
   */
  ttsReady?: () => boolean;
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
   * `engine: 'assets'`; `null` = sin recorte para esa palabra → TTS. El
   * segundo argumento es el idioma/variante de la sesión (accesores
   * `verbalAssetsByLang.ts`); los accesores monolingües siguen siendo válidos.
   */
  assetSource?: (audioKey: string, lang?: string) => string | null;
  /**
   * Recorte de la palabra INCRUSTADO en base64 (m4a). Vía PRIMARIA de
   * reproducción con `engine: 'assets'`: se decodifica en memoria, sin
   * depender de la ruta del asset (en desarrollo el asset es una URL de Metro
   * que la vía nativa por ruta no abre — por eso no sonaba en Android Studio).
   * Si falta, se cae a `assetSource` (ruta) y luego a TTS. `null` = sin recorte.
   */
  assetBase64?: (audioKey: string, lang?: string) => string | null;
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

  // Contexto ÚNICO de la app: este adaptador creaba antes su propio
  // AudioContext y, con él, un segundo stream nativo que en Android (Oboe
  // exclusivo) dejaba mudo al de los tonos —o se quedaba mudo él— según cuál
  // arrancase primero.
  const ctx = acquireAudioContext();
  const bufferCache = new Map<string, AudioBuffer>();

  // Nodos del estímulo en curso (para poder detenerlos).
  let source: AudioBufferSourceNode | null = null;
  let gain: GainNode | null = null;
  let panner: StereoPannerNode | null = null;

  const tts = optionalTts();
  const ttsEngine = tts?.default ?? tts;

  // Palabra dictándose por TTS y su recorte de respaldo: si la síntesis falla
  // (voz de red sin conectividad, motor saturado…), `tts-error`/el rechazo de
  // `speak()` degradan ESA palabra al recorte empaquetado en vez de dejarla en
  // silencio. Tras TTS_FAILURE_LIMIT fallos consecutivos se dejan de intentar
  // dictados y el resto de la sesión usa recortes: mejor un estímulo constante
  // (misma locución toda la lista) que una voz que va y viene con el wifi.
  let currentTts: { audioKey: string; levelDb: number; lang?: string } | null = null;
  let ttsConsecutiveFailures = 0;
  const TTS_FAILURE_LIMIT = 2;
  // Selección de la MEJOR voz del dispositivo PARA LA LENGUA DE LA SESIÓN (la
  // más humana): se enumeran las voces instaladas y se elige la neural de mayor
  // calidad del idioma pedido (ver `pickVoiceForLang`), fijándola con
  // `setDefaultVoice`. Solo si el dispositivo no expone la lista se recurre a
  // `setDefaultLanguage`.
  //
  // La VERIFICACIÓN de que existe voz del idioma es imprescindible: sin ella el
  // motor quedaba con la voz por defecto del sistema (a menudo en-US) y las
  // palabras castellanas sonaban «en inglés» (bug de campo). Si no hay ninguna
  // voz utilizable, el TTS se desactiva y se usan los recortes empaquetados.
  //
  // Multi-idioma: el gallego rara vez tiene voz `gl-*` instalada, así que
  // `pickVoiceForLang` degrada a la castellana y lo marca; la voz se refija
  // solo cuando cambia la lengua de la locución (no en cada palabra).
  let ttsSpanishReady = false;
  let ttsVoices: TtsVoice[] = [];
  /** Lengua cuya voz está fijada ahora mismo en el motor. */
  let ttsCurrentLang: string | null = null;
  /** Lenguas ya descartadas por no tener voz utilizable (no reintentar). */
  const ttsUnavailableLangs = new Set<string>();

  const applyVoiceForLang = async (lang: string): Promise<boolean> => {
    if (!ttsEngine) return false;
    if (ttsCurrentLang === lang) return true;
    if (ttsUnavailableLangs.has(lang)) return false;

    const pick = pickVoiceForLang(ttsVoices, lang);
    if (pick?.voice.id) {
      try {
        await ttsEngine.setDefaultVoice?.(pick.voice.id);
        ttsCurrentLang = lang;
        if (pick.degraded) {
          console.warn(
            `VIA+: sin voz del sistema para '${lang}'; se dicta con una voz '${pick.langPrefix}'.`,
          );
        }
        return true;
      } catch {
        /* la voz elegida no se pudo fijar: probamos por etiqueta de idioma */
      }
    }
    try {
      await ttsEngine.setDefaultLanguage?.(ttsLanguageTagFor(lang));
      ttsCurrentLang = lang;
      return true;
    } catch {
      // Ni voz ni datos del idioma: se descarta esa lengua para no reintentar
      // en cada palabra (y se degrada a recortes / silencio).
      ttsUnavailableLangs.add(lang);
      return false;
    }
  };

  const configureTts = async () => {
    if (!ttsEngine) return;
    try {
      await ttsEngine.getInitStatus?.();
      // Ritmo natural de palabra aislada: ni acelerado ni arrastrado (las voces
      // neurales suenan artificiales muy lentas; 0.48 mantiene naturalidad).
      try { await ttsEngine.setDefaultRate?.(0.48); } catch { /* opcional */ }
      try { await ttsEngine.setDefaultPitch?.(1.0); } catch { /* opcional */ }

      ttsVoices = (await ttsEngine.voices?.()) ?? [];
      // `ttsSpanishReady` gobierna si hay ALGUNA vía de dictado; la voz
      // concreta se fija por locución según su lengua.
      ttsSpanishReady = await applyVoiceForLang('es');
    } catch {
      /* motor TTS no inicializable: queda desactivado */
    }
  };
  void configureTts();

  const stop = () => {
    // Detención deliberada: anula el respaldo pendiente para que el
    // `tts-cancel`/`tts-error` que pueda emitir el motor al abortar el dictado
    // no dispare el recorte de una palabra que ya no debe sonar.
    currentTts = null;
    try { source?.stop(); } catch {}
    try { source?.disconnect(); } catch {}
    try { gain?.disconnect(); } catch {}
    try { panner?.disconnect(); } catch {}
    source = null; gain = null; panner = null;
    try { ttsEngine?.stop?.(); } catch {}
  };

  /**
   * Dicta la palabra con la voz VERIFICADA de la lengua indicada. Devuelve la
   * promesa de `speak()` para que el llamador pueda DEGRADAR al recorte si la
   * síntesis falla (p. ej. voz de red sin conectividad): rechaza si no hay voz
   * utilizable o si el motor rechaza el dictado. Nunca dicta con voz inglesa.
   */
  const speakWord = (word: string, levelDb: number, lang = 'es'): Promise<unknown> => {
    // Sin motor o sin voz verificada: modo demostración (el clínico presenta
    // el modelo con su voz).
    if (!ttsEngine || !ttsSpanishReady) return Promise.reject(new Error('sin voz del sistema'));
    // Se fija la voz de la lengua ANTES de dictar (no-op si ya está fijada):
    // sin esto, una sesión gallega dictaba con la voz castellana ya cargada.
    return applyVoiceForLang(lang).then(ok => {
      if (!ok) throw new Error(`sin voz del sistema para '${lang}'`);
      ttsEngine.stop?.();
      // Sintetizador nativo (Android: TextToSpeech). El nivel relativo se
      // aplica con KEY_PARAM_VOLUME (misma ganancia que los recortes) y la
      // presentación binaural centrada con KEY_PARAM_PAN = 0, por el stream
      // de música (mismo canal de salida que el resto de estímulos).
      return ttsEngine.speak?.(word, {
        androidParams: {
          KEY_PARAM_VOLUME: levelToGain(levelDb),
          KEY_PARAM_PAN: 0,
          KEY_PARAM_STREAM: 'STREAM_MUSIC',
        },
      });
    });
  };

  const playBuffer = (buffer: AudioBuffer, levelDb: number) => {
    if (!ctx) return;
    // Reactivar el contexto si el sistema lo suspendió (ver audiometryToneAdapter).
    resumeAudioContext();
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
  const decodeClip = async (audioKey: string, lang?: string): Promise<AudioBuffer> => {
    if (!ctx) throw new Error('sin AudioContext');
    const b64 = assetBase64?.(audioKey, lang) ?? null;
    if (b64) {
      const bytes = Buffer.from(b64, 'base64');
      const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      return await ctx.decodeAudioData(ab as ArrayBuffer);
    }
    const path = assetSource?.(audioKey, lang) ?? null;
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

  /**
   * Dictado de consignas (frases completas) con la voz verificada de la lengua
   * de sesión. Es la vía que usan los mini-juegos de funciones ejecutivas y el
   * resto de módulos a través de `@/Voice`.
   */
  const speakText = (text: string, lang = 'es') => {
    if (!ttsEngine || !ttsSpanishReady) return;
    currentTts = null; // la consigna sustituye cualquier palabra pendiente
    applyVoiceForLang(lang)
      .then(ok => {
        if (!ok) return;
        ttsEngine.stop?.();
        return ttsEngine.speak?.(text, {
          androidParams: {
            KEY_PARAM_VOLUME: 1,
            KEY_PARAM_PAN: 0,
            KEY_PARAM_STREAM: 'STREAM_MUSIC',
          },
        });
      })
      .catch(() => { /* ayuda de accesibilidad: sin respaldo */ });
  };

  /**
   * Reproduce el recorte empaquetado de la palabra. `onFail` se invoca si el
   * recorte falta o no decodifica (en la vía recortes-primario permite degradar
   * a TTS; en el respaldo por fallo de TTS no queda más vía y se omite).
   */
  const playClip = (audioKey: string, levelDb: number, lang?: string, onFail?: () => void) => {
    if (!ctx) {
      onFail?.();
      return;
    }
    const cacheKey = `${lang ?? 'es'}:${audioKey}`;
    const cached = bufferCache.get(cacheKey);
    if (cached) {
      playBuffer(cached, levelDb);
      return;
    }
    decodeClip(audioKey, lang)
      .then(buffer => {
        bufferCache.set(cacheKey, buffer);
        playBuffer(buffer, levelDb);
      })
      .catch(() => onFail?.());
  };

  const playWord = (audioKey: string, word: string, levelDb: number, lang?: string) => {
    stop();
    const sessionLang = lang ?? 'es';
    const hasClip =
      engine === 'assets' && (!!assetBase64?.(audioKey, lang) || !!assetSource?.(audioKey, lang));
    // VARIANTES del castellano (es-DO): los recortes empaquetados son el
    // estímulo validado por el logopeda de la variante y SIEMPRE la vía
    // primaria — el TTS del dispositivo impondría otro acento y solo queda
    // como último recurso. El GALLEGO no es una variante: es otro idioma sin
    // recortes propios todavía, así que su vía primaria es el TTS (con la voz
    // gallega si la hay y, si no, la castellana declarada como degradación).
    const isSpanishVariant = sessionLang !== 'es' && sessionLang.startsWith('es');

    // Vía PRIMARIA: TTS neural del dispositivo (voz humana) cuando hay voz
    // verificada para la lengua. El recorte queda de respaldo REAL: si
    // `speak()` rechaza o el motor emite `tts-error` (síntesis de red sin
    // conexión, motor saturado…), esa palabra suena por el recorte y, tras
    // varios fallos seguidos, la sesión entera pasa a recortes — antes el
    // fallo se tragaba en silencio y la prueba se quedaba muda a mitad de la
    // lista.
    if (!isSpanishVariant && preferTts && ttsSpanishReady && ttsConsecutiveFailures < TTS_FAILURE_LIMIT) {
      currentTts = { audioKey, levelDb, lang };
      speakWord(word, levelDb, sessionLang).catch(() => {
        ttsConsecutiveFailures += 1;
        currentTts = null;
        if (hasClip) playClip(audioKey, levelDb, lang);
      });
      return;
    }

    // Sin TTS utilizable (o variante del castellano): recortes empaquetados.
    if (!hasClip || !ctx) {
      // Último recurso (silencioso si tampoco hay voz del sistema).
      speakWord(word, levelDb, sessionLang).catch(() => { /* sin vía de emisión */ });
      return;
    }
    // Recorte ilegible → degradar a TTS por palabra (comportamiento histórico).
    playClip(audioKey, levelDb, lang, () => {
      speakWord(word, levelDb, sessionLang).catch(() => { /* sin vía de emisión */ });
    });
  };

  // Fallos ASÍNCRONOS de síntesis: en Android `speak()` resuelve al encolar y
  // el error real (p. ej. la voz de red sin conectividad) llega después por el
  // evento `tts-error`. Se degrada la palabra en curso a su recorte y se
  // contabiliza el fallo; `tts-finish` confirma que el motor está sano y
  // resetea el contador. `tts-cancel` (detención deliberada) no se escucha.
  const onTtsFinish = () => {
    ttsConsecutiveFailures = 0;
    currentTts = null;
  };
  const onTtsError = () => {
    ttsConsecutiveFailures += 1;
    const failed = currentTts;
    currentTts = null;
    if (failed) playClip(failed.audioKey, failed.levelDb, failed.lang);
  };
  try {
    ttsEngine?.addEventListener?.('tts-finish', onTtsFinish);
    ttsEngine?.addEventListener?.('tts-error', onTtsError);
  } catch {
    /* motor sin eventos: la degradación por promesa rechazada sigue operativa */
  }

  setVerbalAudioAdapter({
    playWord,
    speakText,
    ttsReady: () => ttsSpanishReady,
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
    try {
      ttsEngine?.removeEventListener?.('tts-finish', onTtsFinish);
      ttsEngine?.removeEventListener?.('tts-error', onTtsError);
    } catch {}
    bufferCache.clear();
    // El contexto es compartido: solo se suelta la referencia.
    releaseAudioContext();
  };
}
