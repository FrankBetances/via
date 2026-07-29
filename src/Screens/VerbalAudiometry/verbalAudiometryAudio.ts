import { Buffer } from 'buffer';
import type {
  AudioBuffer,
  AudioBufferSourceNode,
  GainNode,
  StereoPannerNode,
} from 'react-native-audio-api';

import { acquireAudioContext, releaseAudioContext, resumeAudioContext } from '@/Audio';
import { SESSION_LANGS } from '@/Store/slices/sessionLangs';
import { pickVoiceForLang, ttsLanguageTagFor, type TtsVoice } from './verbalTtsVoice';

/**
 * Lenguas que se prueban al arrancar el motor, en orden. Basta que UNA quede
 * fijada para que haya vía de dictado; la voz concreta se reajusta por
 * locución. Antes solo se probaba el castellano, así que un dispositivo con
 * voz gallega o vasca pero sin datos de español se declaraba «sin voz».
 */
const TTS_PROBE_LANGS: readonly string[] = SESSION_LANGS;

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

/** Fase del motor de voz del sistema. */
export type TtsPhase = 'initializing' | 'ready' | 'unavailable';

export interface TtsStatus {
  phase: TtsPhase;
  /** Motivo legible cuando no hay voz (para mostrárselo al profesional). */
  detail: string;
  /** Nº de voces que expone el dispositivo (0 = el motor no las enumera). */
  voiceCount: number;
  /** Lengua cuya voz está fijada ahora en el motor (`null` = ninguna). */
  currentLang: string | null;
  /** `true` si la voz en uso no es del idioma pedido (p. ej. gl dictado en es). */
  degraded: boolean;
}

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
  /**
   * Estado detallado del motor de voz del sistema, para que la UI pueda
   * DECIR qué pasa en vez de limitarse a no sonar. Opcional para no romper
   * adaptadores de prueba ya registrados.
   */
  ttsStatus?: () => TtsStatus;
  /**
   * Reintenta la inicialización del motor (el usuario acaba de instalar una
   * voz, o el motor no estaba listo al arrancar la app). Resuelve a `true` si
   * quedó operativo.
   */
  retryTts?: () => Promise<boolean>;
  /** Suscripción a los cambios de `ttsStatus` (devuelve la baja). */
  onTtsStatusChange?: (listener: () => void) => () => void;
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
  /** ¿La voz fijada es una degradación (otro idioma que el pedido)? */
  let ttsDegraded = false;
  /** Lenguas ya descartadas por no tener voz utilizable (no reintentar). */
  const ttsUnavailableLangs = new Set<string>();

  /* ------------------------- estado observable ---------------------------- */

  let ttsPhase: TtsPhase = ttsEngine ? 'initializing' : 'unavailable';
  let ttsDetail = ttsEngine
    ? 'Preparando la voz del dispositivo…'
    : 'Este dispositivo no incorpora el módulo de síntesis de voz.';
  const statusListeners = new Set<() => void>();
  const notifyStatus = () => statusListeners.forEach(l => l());

  const setPhase = (phase: TtsPhase, detail: string) => {
    if (ttsPhase === phase && ttsDetail === detail) return;
    ttsPhase = phase;
    ttsDetail = detail;
    notifyStatus();
  };

  const ttsStatus = (): TtsStatus => ({
    phase: ttsPhase,
    detail: ttsDetail,
    voiceCount: ttsVoices.length,
    currentLang: ttsCurrentLang,
    degraded: ttsDegraded,
  });

  const applyVoiceForLang = async (lang: string): Promise<boolean> => {
    if (!ttsEngine) return false;
    if (ttsCurrentLang === lang) return true;
    if (ttsUnavailableLangs.has(lang)) return false;

    const pick = pickVoiceForLang(ttsVoices, lang);
    if (pick?.voice.id) {
      try {
        await ttsEngine.setDefaultVoice?.(pick.voice.id);
        ttsCurrentLang = lang;
        ttsDegraded = pick.degraded;
        if (pick.degraded) {
          console.warn(
            `VIA+: sin voz del sistema para '${lang}'; se dicta con una voz '${pick.langPrefix}'.`,
          );
        }
        notifyStatus();
        return true;
      } catch {
        /* la voz elegida no se pudo fijar: probamos por etiqueta de idioma */
      }
    }
    // Vía por ETIQUETA de idioma. Es la que funciona en los motores que no
    // enumeran voces (y en los que `setDefaultVoice` rechaza ids válidos), así
    // que nunca debe saltarse: era la razón por la que un dispositivo con TTS
    // perfectamente utilizable se quedaba mudo.
    try {
      const result = await ttsEngine.setDefaultLanguage?.(ttsLanguageTagFor(lang));
      // Android devuelve un código negativo si al idioma le faltan datos; el
      // `await` no rechaza, así que hay que mirarlo.
      if (typeof result === 'number' && result < 0) throw new Error(`idioma no disponible (${result})`);
      ttsCurrentLang = lang;
      ttsDegraded = false;
      notifyStatus();
      return true;
    } catch {
      // Ni voz ni datos del idioma: se descarta esa lengua para no reintentar
      // en cada palabra (y se degrada a recortes / silencio).
      ttsUnavailableLangs.add(lang);
      return false;
    }
  };

  /* ------------------------ inicialización del motor ----------------------- */

  /** Intentos de arranque del motor antes de darlo por no disponible. */
  const TTS_INIT_ATTEMPTS = 3;
  /** Espera entre intentos (ms). El TextToSpeech de Android tarda en estar
   *  listo tras el arranque en frío y `getInitStatus()` rechaza mientras tanto. */
  const TTS_INIT_RETRY_MS = 700;
  /** Tope de espera de una locución por la inicialización en curso. */
  const TTS_READY_TIMEOUT_MS = 2500;

  const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

  /**
   * Arranque del motor por PASOS INDEPENDIENTES. La versión anterior envolvía
   * todo en un único `try`: si `getInitStatus()` rechazaba (arranque en frío,
   * motor todavía cargando) o si `voices()` fallaba, se abortaba entero y
   * `ttsSpanishReady` quedaba en `false` PARA SIEMPRE — sin reintento y sin
   * decir nada. De ahí el «ningún motor de voz funciona»: bastaba un fallo
   * transitorio en el primer segundo de vida de la app.
   */
  const configureTts = async (): Promise<boolean> => {
    if (!ttsEngine) {
      setPhase('unavailable', 'Este dispositivo no incorpora el módulo de síntesis de voz.');
      return false;
    }

    // Paso 1 — esperar a que el motor esté inicializado, con reintentos.
    let initError: unknown = null;
    for (let attempt = 1; attempt <= TTS_INIT_ATTEMPTS; attempt++) {
      try {
        await ttsEngine.getInitStatus?.();
        initError = null;
        break;
      } catch (e) {
        initError = e;
        if (attempt < TTS_INIT_ATTEMPTS) await delay(TTS_INIT_RETRY_MS);
      }
    }
    if (initError) {
      const code = (initError as { code?: string })?.code;
      setPhase(
        'unavailable',
        code === 'no_engine'
          ? 'No hay ningún motor de síntesis de voz instalado. Instale «Voz de Google» (o el motor del fabricante) desde la tienda de aplicaciones.'
          : 'El motor de voz del dispositivo no llegó a inicializarse. Reintente desde este mismo aviso.',
      );
      return false;
    }

    // Paso 2 — prosodia. Opcional: que falle no impide dictar.
    try { await ttsEngine.setDefaultRate?.(0.48); } catch { /* ritmo por defecto */ }
    try { await ttsEngine.setDefaultPitch?.(1.0); } catch { /* tono por defecto */ }

    // Paso 3 — lista de voces. Que un motor no la exponga es NORMAL, no un
    // fallo: se dicta fijando la etiqueta de idioma.
    try {
      ttsVoices = (await ttsEngine.voices?.()) ?? [];
    } catch {
      ttsVoices = [];
    }

    // Paso 4 — fijar una voz utilizable. Se reintentan todas las lenguas de
    // sesión: un dispositivo puede no tener castellano pero sí euskera o
    // gallego, y antes se declaraba «sin voz» solo por mirar el castellano.
    ttsUnavailableLangs.clear();
    ttsCurrentLang = null;
    for (const lang of TTS_PROBE_LANGS) {
      if (await applyVoiceForLang(lang)) {
        ttsSpanishReady = true;
        setPhase('ready', `Voz del sistema lista (${ttsVoices.length || 'sin lista de'} voces).`);
        return true;
      }
    }

    ttsSpanishReady = false;
    setPhase(
      'unavailable',
      ttsVoices.length
        ? 'El motor de voz no tiene ninguna voz de los idiomas de la batería. Instale los datos de voz en español desde los ajustes del sistema.'
        : 'El motor de voz no expone ninguna voz utilizable. Revise los ajustes de síntesis de voz del sistema.',
    );
    return false;
  };

  /** Configuración en curso (evita arrancar varias a la vez). */
  let configuring: Promise<boolean> | null = null;

  /**
   * Garantiza que el motor esté listo antes de dictar. Si sigue arrancando,
   * espera (acotado) en vez de descartar la locución: antes, cualquier `speak`
   * de los primeros ~2 s se tragaba en silencio porque `ttsSpanishReady`
   * todavía era `false`.
   */
  const ensureTtsReady = (): Promise<boolean> => {
    if (ttsSpanishReady) return Promise.resolve(true);
    if (!ttsEngine) return Promise.resolve(false);
    if (!configuring) {
      configuring = configureTts().finally(() => {
        configuring = null;
      });
    }
    // Carrera contra un tope de espera. El temporizador se cancela en cuanto
    // la configuración termina: dejarlo vivo mantenía el proceso despierto
    // (y hacía que Jest avisase de operaciones pendientes).
    let timer: ReturnType<typeof setTimeout> | null = null;
    const timeout = new Promise<boolean>(resolve => {
      timer = setTimeout(() => resolve(ttsSpanishReady), TTS_READY_TIMEOUT_MS);
    });
    return Promise.race([configuring, timeout]).finally(() => {
      if (timer) clearTimeout(timer);
    });
  };

  /** Reintento explícito (botón de la UI): olvida el veredicto anterior. */
  const retryTts = (): Promise<boolean> => {
    ttsSpanishReady = false;
    ttsCurrentLang = null;
    ttsUnavailableLangs.clear();
    setPhase('initializing', 'Preparando la voz del dispositivo…');
    return ensureTtsReady();
  };

  void ensureTtsReady();

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
    // el modelo con su voz). Si el motor SIGUE arrancando se espera a que
    // termine en vez de descartar la palabra.
    return ensureTtsReady().then(ready => {
      if (!ttsEngine || !ready) throw new Error('sin voz del sistema');
      // Se fija la voz de la lengua ANTES de dictar (no-op si ya está fijada):
      // sin esto, una sesión gallega dictaba con la voz castellana ya cargada.
      return applyVoiceForLang(lang);
    }).then(ok => {
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
    if (!ttsEngine) return;
    currentTts = null; // la consigna sustituye cualquier palabra pendiente
    ensureTtsReady()
      .then(ready => (ready ? applyVoiceForLang(lang) : false))
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
    //
    // `ttsPhase !== 'unavailable'` (en vez de `ttsSpanishReady`) evita que la
    // PRIMERA palabra de la sesión caiga al recorte solo porque el motor aún
    // esté arrancando: `speakWord` espera a que termine y, si no llega a
    // estarlo, degrada igual.
    if (!isSpanishVariant && preferTts && ttsPhase !== 'unavailable' && ttsConsecutiveFailures < TTS_FAILURE_LIMIT) {
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
    ttsStatus,
    retryTts,
    onTtsStatusChange: listener => {
      statusListeners.add(listener);
      return () => statusListeners.delete(listener);
    },
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
