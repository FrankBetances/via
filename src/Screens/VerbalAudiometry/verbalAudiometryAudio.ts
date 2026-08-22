import { Buffer } from 'buffer';
import type {
  AudioBuffer,
  AudioBufferSourceNode,
  GainNode,
  StereoPannerNode,
} from 'react-native-audio-api';

import { acquireAudioContext, releaseAudioContext, resumeAudioContext } from '@/Audio';
import { pickVoiceForLang, ttsLanguageTagFor, type TtsVoice } from './verbalTtsVoice';

/**
 * Lenguas que se prueban al arrancar el motor, en orden. Basta que UNA quede
 * fijada para que haya vía de dictado; la voz concreta se reajusta por
 * locución. Antes solo se probaba el castellano, así que un dispositivo con
 * voz gallega o vasca pero sin datos de español se declaraba «sin voz».
 */

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
/*   2. 'tts' — SINTETIZADOR NATIVO del sistema vía `expo-speech`             */
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
   * Decodifica y cachea el recorte de una palabra SIN reproducirlo, para que
   * la presentación siguiente suene de inmediato. La pantalla lo llama al
   * mostrar cada lámina: sin esto, la primera emisión llegaba después de
   * decodificar (base64 → PCM) y el estímulo se percibía como «no ha sonado».
   * Opcional para no romper adaptadores de prueba ya registrados.
   */
  prime?: (audioKey: string, lang?: string) => void;
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

/* Metro exige literales en `require(...)` (ver articulationAudio.ts).
 *
 * MOTOR: `expo-speech`, migrado desde `react-native-tts`. El motivo no es
 * estético. `react-native-tts` devuelve la lista de voces con este código:
 *
 *     String country = voice.getLocale().getISO3Country();
 *     if (country != "") { ... iso3CountryCodeToIso2CountryCode(country) ... }
 *
 * `country != ""` compara REFERENCIAS en Java, no contenido: con país vacío
 * entra igual, y la conversión hace `map.get("").getCountry()` sin comprobar
 * null → NullPointerException. El `catch` está FUERA del bucle, así que la
 * lista de voces vuelve truncada o vacía, en silencio. Toda la selección de voz
 * de VIA+ colgaba de esa lista.
 *
 * `expo-speech` es el motor que usa Valeria+ (`src/valeriaVoice.ts`), que
 * locuta con voz neural en el mismo emulador donde VIA+ se quedaba mudo. */
const optionalTts = (): any => {
  try {
    const mod = require('expo-speech');
    return typeof mod?.speak === 'function' ? mod : null;
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
  // `let` y no `const`: si el sistema tira el contexto (Android puede cerrarlo
  // al perder el foco de audio), los puntos de reproducción lo vuelven a
  // adquirir en vez de quedarse mudos para el resto de la sesión.
  let ctx = acquireAudioContext();
  const bufferCache = new Map<string, AudioBuffer>();

  // Nodos del estímulo en curso (para poder detenerlos).
  let source: AudioBufferSourceNode | null = null;
  let gain: GainNode | null = null;
  let panner: StereoPannerNode | null = null;

  const ttsEngine = optionalTts();

  // Palabra dictándose por TTS y su recorte de respaldo: si la síntesis falla
  // (voz de red sin conectividad, motor saturado…), `tts-error`/el rechazo de
  // `speak()` degradan ESA palabra al recorte empaquetado en vez de dejarla en
  // silencio. Tras TTS_FAILURE_LIMIT fallos consecutivos se dejan de intentar
  // dictados y el resto de la sesión usa recortes: mejor un estímulo constante
  // (misma locución toda la lista) que una voz que va y viene con el wifi.
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

  /**
   * Voz preferida para una lengua. PURA: no toca el motor.
   *
   * Éste es el cambio de fondo respecto a la versión con `react-native-tts`.
   * Aquella FIJABA la voz en el motor (`setDefaultVoice` / `setDefaultLanguage`)
   * y, si no lo conseguía, marcaba la lengua como imposible y DEJABA DE DICTAR.
   * Es decir: la selección de voz era una PUERTA. Bastaba que el motor no
   * enumerase voces —o que las enumerase mal, que es justo lo que hace el bug
   * de `voices()` documentado arriba— para que la app se quedara muda en todos
   * los módulos, sin decir por qué.
   *
   * `expo-speech` recibe la voz y la lengua como opciones DE CADA LOCUCIÓN, así
   * que la elección vuelve a ser lo que debe ser: una PREFERENCIA. Si hay voz
   * del idioma, se usa; si no, se dicta igualmente pasando `language` y que el
   * motor resuelva. Es la disciplina de Valeria+ (`scoreVoice` elige la mejor,
   * `Speech.speak` se llama siempre), y es la razón de que allí sí se oiga.
   */
  const voiceForLang = (lang: string): { voiceId?: string; degraded: boolean } => {
    const pick = pickVoiceForLang(ttsVoices, lang);
    if (!pick) return { degraded: false };
    return { voiceId: pick.voice.id, degraded: pick.degraded };
  };

  /**
   * Opciones de locución para una lengua. `language` va SIEMPRE, aunque haya
   * voz elegida: es la red de seguridad si el id de voz no le vale al motor.
   */
  const speechOptionsFor = (lang: string) => {
    const { voiceId, degraded } = voiceForLang(lang);
    if (ttsCurrentLang !== lang || ttsDegraded !== degraded) {
      ttsCurrentLang = lang;
      ttsDegraded = degraded;
      if (degraded) {
        console.warn(`VIA+: sin voz del sistema para '${lang}'; se dicta con otra voz.`);
      }
      notifyStatus();
    }
    return {
      language: ttsLanguageTagFor(lang),
      ...(voiceId ? { voice: voiceId } : {}),
      rate: 0.48,
      pitch: 1.0,
    };
  };

  /* ------------------------ inicialización del motor ----------------------- */

  /** Tope de espera de una locución por la enumeración de voces en curso. */
  const TTS_READY_TIMEOUT_MS = 2500;

  /* `expo-speech` no tiene fase de arranque: no existe `getInitStatus()` ni,
   * por tanto, el arranque en frío que había que reintentar tres veces con
   * `react-native-tts`. Lo único que se espera aquí es la enumeración de voces,
   * y ni siquiera es bloqueante: sin lista se dicta por etiqueta de idioma. */

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

    // Lista de voces. Que el motor no la exponga —o la exponga vacía— es
    // NORMAL, no un fallo: se dicta pasando la etiqueta de idioma y que el
    // sistema resuelva. La versión anterior trataba una lista vacía como «no
    // hay voz» y enmudecía la app entera; con el bug de `voices()` de
    // react-native-tts, esa lista venía vacía en dispositivos perfectamente
    // capaces. Nunca más se falla cerrado por no poder enumerar.
    try {
      ttsVoices = ((await ttsEngine.getAvailableVoicesAsync?.()) ?? []).map((v: any) => ({
        id: v.identifier,
        name: v.name,
        language: v.language,
        // expo-speech expone la calidad como 'Enhanced' | 'Default'; se traduce
        // a la escala numérica de Android (500 mejorada / 300 normal) que ya
        // usa `scoreVoiceOf`, para no duplicar la lógica de puntuación.
        quality: v.quality === 'Enhanced' ? 500 : 300,
      }));
    } catch {
      ttsVoices = [];
    }

    // Hay motor: hay voz. La calidad la decide `voiceForLang` locución a
    // locución, y si no encuentra una del idioma se dicta igual con la
    // etiqueta de lengua.
    ttsSpanishReady = true;
    const withVoice = ttsVoices.length;
    setPhase(
      'ready',
      withVoice
        ? `Voz del sistema lista (${withVoice} voces).`
        : 'Voz del sistema lista (el motor no enumera voces; se dicta por etiqueta de idioma).',
    );
    return true;
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
    setPhase('initializing', 'Preparando la voz del dispositivo…');
    return ensureTtsReady();
  };

  void ensureTtsReady();

  const stop = () => {
    // Detención deliberada. Con `expo-speech` no hace falta anular ningún
    // respaldo pendiente: la parada llega por el `onStopped` de esa misma
    // locución, que `speakWord` trata como fin normal y no como fallo.
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
  /**
   * Dicta la palabra con la mejor voz disponible para la lengua. La promesa se
   * resuelve cuando el motor termina de hablar y se RECHAZA si la síntesis
   * falla, para que `playWord` degrade esa palabra a su recorte empaquetado.
   *
   * NIVEL DE PRESENTACIÓN — LIMITACIÓN DECLARADA. La versión con
   * `react-native-tts` aplicaba el nivel con `KEY_PARAM_VOLUME`. `expo-speech`
   * expone `volume` SOLO en web, así que por esta vía NO hay control de nivel.
   *
   * No es una regresión clínica, y conviene dejarlo escrito: anunciar «65 dB»
   * sobre la voz del sistema siempre fue una ficción —el nivel absoluto depende
   * del motor, del volumen del dispositivo y del altavoz, nada de lo cual está
   * calibrado—. El estímulo con nivel de verdad son los RECORTES empaquetados,
   * que se reproducen por `playBuffer` con un nodo de ganancia y siguen siendo
   * la vía primaria (`preferTts: false` en App.tsx). El TTS queda donde le
   * corresponde: respaldo audible para las lenguas sin banco de recortes, sin
   * pretensión de calibración.
   */
  const speakWord = (word: string, _levelDb: number, lang = 'es'): Promise<unknown> =>
    ensureTtsReady().then(
      ready =>
        new Promise((resolve, reject) => {
          if (!ttsEngine || !ready) throw new Error('sin voz del sistema');
          try {
            ttsEngine.stop?.();
          } catch {
            /* nada que detener */
          }
          ttsEngine.speak(word, {
            ...speechOptionsFor(lang),
            onDone: () => resolve(undefined),
            // Una parada deliberada (otra locución toma el relevo) NO es un
            // fallo: contarla degradaría la sesión a recortes por hacer bien
            // la preempción.
            onStopped: () => resolve(undefined),
            onError: (e: unknown) => reject(e instanceof Error ? e : new Error('síntesis fallida')),
          });
        }),
    );
  // NO se captura aquí: el rechazo DEBE propagarse a `playWord`, que es quien
  // contabiliza el fallo (para degradar la sesión entera tras varios seguidos)
  // y degrada la palabra a su recorte empaquetado.


  const playBuffer = (buffer: AudioBuffer, levelDb: number) => {
    if (!ctx) ctx = acquireAudioContext();
    if (!ctx) return;
    // Reactivar el contexto si el sistema lo suspendió (ver audiometryToneAdapter).
    resumeAudioContext();
    const now = ctx.currentTime;
    try {
      source = ctx.createBufferSource();
      source.buffer = buffer;
      gain = ctx.createGain();
      panner = ctx.createStereoPanner();
      panner.pan.value = 0; // campo libre binaural: centrado en ambos altavoces
      const level = levelToGain(levelDb);
      // Rampas anti-click de 15 ms al inicio y al final del recorte.
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(level, now + 0.015);
      const end = now + (buffer.duration || 1);
      gain.gain.setValueAtTime(level, Math.max(now + 0.015, end - 0.015));
      gain.gain.linearRampToValueAtTime(0, end);
      source.connect(gain);
      gain.connect(panner);
      panner.connect(ctx.destination);
      source.start(now);
    } catch (_e) {
      /* si el buffer nativo falla, no tumbar el flujo */
    }
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
    if (!ctx) ctx = acquireAudioContext();
    if (!ctx) throw new Error('sin AudioContext');
    resumeAudioContext();
    const b64 = assetBase64?.(audioKey, lang) ?? null;
    if (b64) {
      try {
        const bytes = Buffer.from(b64, 'base64');
        const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
        return await ctx.decodeAudioData(ab as ArrayBuffer);
      } catch (_e) {
        /* continua a fallback */
      }
    }
    const path = assetSource?.(audioKey, lang) ?? null;
    if (path) {
      try {
        return await ctx.decodeAudioDataSource(path);
      } catch (e) {
        try {
          const res = await fetch(path);
          const data = await res.arrayBuffer();
          if (ctx) return await ctx.decodeAudioData(data);
        } catch (_err) {
          /* continua a error */
        }
      }
    }
    throw new Error(`sin recorte para la palabra '${audioKey}'`);
  };

  /**
   * Dictado de consignas (frases completas) con la voz verificada de la lengua
   * de sesión. Es la vía que usan los mini-juegos de funciones ejecutivas y el
   * resto de módulos a través de `@/Voice`.
   */
  /**
   * Dicta un texto libre (consignas de los módulos, modelo hablado del T.A.R.,
   * ayudas de accesibilidad). Fire-and-forget: es una ayuda, no un estímulo
   * calibrado, así que no tiene respaldo ni informa de fallo.
   */
  const speakText = (text: string, lang = 'es') => {
    if (!ttsEngine) return;
    ensureTtsReady()
      .then(ready => {
        if (!ready) return;
        try {
          ttsEngine.stop?.();
        } catch {
          /* nada que detener */
        }
        ttsEngine.speak(text, speechOptionsFor(lang));
      })
      .catch(() => {
        /* ayuda de accesibilidad: sin respaldo */
      });
  };

  /**
   * Reproduce el recorte empaquetado de la palabra. `onFail` se invoca si el
   * recorte falta o no decodifica (en la vía recortes-primario permite degradar
   * a TTS; en el respaldo por fallo de TTS no queda más vía y se omite).
   */
  const playClip = (audioKey: string, levelDb: number, lang?: string, onFail?: () => void) => {
    if (!ctx) ctx = acquireAudioContext();
    if (!ctx) {
      onFail?.();
      return;
    }
    resumeAudioContext();
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

  /**
   * Precarga el recorte en la caché de buffers. Silencioso: si no hay recorte
   * (gl/eu) o no decodifica, no pasa nada — `playWord` degradará igual.
   */
  const prime = (audioKey: string, lang?: string) => {
    if (!ctx) ctx = acquireAudioContext();
    if (!ctx) return;
    const cacheKey = `${lang ?? 'es'}:${audioKey}`;
    if (bufferCache.has(cacheKey)) return;
    decodeClip(audioKey, lang)
      .then(buffer => bufferCache.set(cacheKey, buffer))
      .catch(() => { /* sin recorte: la degradación la resuelve playWord */ });
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
      speakWord(word, levelDb, sessionLang).then(
        () => {
          // Una locución COMPLETADA confirma que el motor está sano y devuelve
          // el contador a cero: un fallo aislado (un corte de red puntual) no
          // debe degradar el resto de la sesión a recortes. Con
          // `react-native-tts` esto lo hacía el evento global `tts-finish`;
          // con `expo-speech` el resultado viaja con la propia promesa, que es
          // justo lo que evita tener que emparejar eventos con palabras.
          ttsConsecutiveFailures = 0;
        },
        () => {
          ttsConsecutiveFailures += 1;
          if (hasClip) playClip(audioKey, levelDb, lang, () => speakText(word, sessionLang));
          else speakText(word, sessionLang);
        },
      );
      return;
    }

    // Sin TTS utilizable (o variante del castellano): recortes empaquetados.
    if (!hasClip || !ctx) {
      // Último recurso (silencioso si tampoco hay voz del sistema).
      speakWord(word, levelDb, sessionLang).catch(() => { speakText(word, sessionLang); });
      return;
    }
    // Recorte ilegible → degradar a TTS por palabra (comportamiento histórico).
    playClip(audioKey, levelDb, lang, () => {
      speakWord(word, levelDb, sessionLang).catch(() => { speakText(word, sessionLang); });
    });
  };

  // Con `react-native-tts` hacía falta escuchar los eventos GLOBALES
  // `tts-finish`/`tts-error`, porque su `speak()` resolvía al ENCOLAR y el
  // fallo real llegaba después por el emisor. `expo-speech` entrega
  // `onDone`/`onError` por LOCUCIÓN, así que el resultado ya viaja con la
  // promesa de `speakWord` y no hace falta estado global que sincronizar: la
  // degradación al recorte y el contador de fallos viven en `playWord`.

  setVerbalAudioAdapter({
    playWord,
    prime,
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
    bufferCache.clear();
    // El contexto es compartido: solo se suelta la referencia.
    releaseAudioContext();
  };
}
