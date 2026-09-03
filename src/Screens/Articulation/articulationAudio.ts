import { useCallback, useEffect, useRef, useState } from 'react';

import {
  acquireAudioContext,
  acquireRecorder,
  acquireRecordingSession,
  clampSample,
  isRecorderAvailable,
  peekAudioContext,
  playbackNormalizationGain,
  releaseAudioContext,
  resumeAudioContext,
  setRecorderPermissionGranted,
  type SharedRecorder,
} from '@/Audio';
import { createDecimator3, DECIMATION, SAMPLE_RATE } from '@/Screens/VoiceAnalysis/voiceDsp';

import { proposeSoda, type SodaProposal } from './articulationPhonetics';
import {
  createSpeechRecognizer,
  isRecognitionAvailable,
  supportsOnDeviceRecognition,
  type SpeechRecognizer,
} from './speechRecognitionBridge';
import {
  probeRecognitionCaps,
  type NativeRecognitionProbe,
  recognitionBlockLabel,
  resolveRecognitionMode,
  type RecognitionBlockReason,
} from './articulationRecognition';
import {
  canSpeakText,
  onVoiceStatusChange,
  speakLocalized,
  stopSpeaking,
  TAR_MODELS,
  tarModelByLang,
} from '@/Voice';

/* -------------------------------------------------------------------------- */
/*  Adaptador de audio del T.A.R.                                              */
/*  Tres capacidades, todas con DEGRADACIÓN (principio VIA+): si la librería   */
/*  nativa no está instalada o falta el permiso, el módulo sigue funcionando   */
/*  (el clínico clasifica SODA manualmente) y la bandera correspondiente queda */
/*  en `false`, de modo que la UI muestra el chip de «modo limitado».          */
/*                                                                              */
/*   1. Modelo hablado               → capa de voz `@/Voice` (ver abajo)        */
/*   2. Grabación de la repetición   → micrófono COMPARTIDO de `@/Audio`        */
/*      (PCM en memoria, sin fichero: ver A3.2 · Zero-PHI)                      */
/*   3. Reconocimiento de voz        → `expo-speech-recognition` (puente)       */
/*      (Android: SpeechRecognizer · iOS: SFSpeechRecognizer)                   */
/*   ·  Permisos de micrófono        → `react-native-permissions`               */
/*                                                                              */
/*  MODELO HABLADO — el módulo montaba su PROPIO `react-native-tts` con        */
/*  `setDefaultLanguage('es-ES')` fijo y llamaba a `speak(word)` a secas: sin   */
/*  elegir voz, el motor dictaba con la que el sistema tuviera por defecto (la  */
/*  clásica, y en un dispositivo sin datos de español incluso en inglés), y el  */
/*  idioma de la sesión no le llegaba nunca. Ahora el modelo pasa por `@/Voice` */
/*  como el resto de la app, que resuelve en este orden: recorte NEURONAL       */
/*  pre-sintetizado de la lengua → recorte neuronal base `es` → voz del sistema */
/*  con la MEJOR voz verificada de esa lengua (`pickVoiceForLang` prioriza las  */
/*  neurales) → silencio. Un solo motor de voz en toda la app, y el T.A.R.      */
/*  hereda gratis las locuciones que sintetice el pipeline.                     */
/* -------------------------------------------------------------------------- */

/* Metro exige literales en `require(...)` para poder empaquetar el módulo: un
 * nombre de variable (`require(name)`) rompe el build de producción aunque la
 * librería esté instalada. Por eso cada caso usa su propio `require` literal. */
type OptionalLibName = 'react-native-permissions';

const optionalRequire = (name: OptionalLibName): any => {
  try {
    switch (name) {
      case 'react-native-permissions':
        return require('react-native-permissions');
    }
  } catch (_e) {
    return null;
  }
};

/**
 * Etiqueta BCP-47 del reconocedor de voz para cada lengua de sesión. El
 * reconocimiento iba clavado a 'es-ES': una sesión dominicana se transcribía
 * con el modelo peninsular y una gallega o vasca, directamente con el
 * castellano. Si el dispositivo no trae el modelo pedido, `startRecognition`
 * reintenta con la lengua base (mejor transcribir con acento ajeno que no
 * transcribir).
 */
const RECOGNITION_LOCALE: Record<string, string> = {
  es: 'es-ES',
  'es-DO': 'es-DO',
  'es-419': 'es-MX',
  gl: 'gl-ES',
  eu: 'eu-ES',
  ca: 'ca-ES',
  en: 'en-US',
};

/** Lengua a la que degrada el reconocedor si no hay modelo para la pedida. */
const RECOGNITION_FALLBACK = 'es-ES';

/** Espera tras detener la captura para recoger los últimos bloques que el motor
 *  nativo entrega por el emisor de eventos (mismo valor que en los adaptadores
 *  de voz y prosodia). Sin ella se pierde la cola de la palabra repetida. */
const TAIL_DRAIN_MS = 250;

/* ───────────────────────────────────────────────────────────────────────────
 * ACTIVAR AUDIO REAL (recomendado para producción)
 * Por defecto se resuelve con `require` opcional (envuelto en try/catch): el
 * build NO se rompe si las librerías no están instaladas y el módulo
 * funciona en modo limitado (SODA manual). Para integrar grabación +
 * reconocimiento reales:
 *   1) instala las deps (ver LEEME §5) y `cd ios && pod install`.
 *   2) descomenta las 3 líneas `import` y las 3 asignaciones de abajo.
 * El import LITERAL garantiza que Metro EMPAQUETE los módulos nativos (un
 * require dinámico podría no incluirlos en el bundle aunque estén instalados).
 * El TTS ya no aparece aquí: el modelo hablado lo sirve `@/Voice`.
 * ─────────────────────────────────────────────────────────────────────────── */
// import * as PermissionsLib from 'react-native-permissions';
let RN_PERMISSIONS: any = null;
// RN_PERMISSIONS = PermissionsLib;

/** Resuelve una lib: usa el import literal (si está activado) o cae al require dinámico. */
const resolveLib = (literal: any, name: OptionalLibName): any => literal ?? optionalRequire(name);

export type RecStatus = 'idle' | 'recording' | 'ready';

export interface ArticulationAudio {
  available: boolean;            // hay motor de grabación
  recognitionAvailable: boolean; // hay motor de reconocimiento de voz USABLE
  /** El reconocimiento está garantizado EN EL DISPOSITIVO (A2 · Zero-PHI). */
  recognitionOnDevice: boolean;
  /** Por qué no se puede transcribir, para que la pantalla lo explique. */
  recognitionBlockReason: RecognitionBlockReason;
  /** Texto listo para pantalla del motivo de bloqueo. */
  recognitionBlockLabel: string;
  /** Hay alguna vía para el modelo hablado (recorte neuronal o voz del sistema). */
  modelVoiceAvailable: boolean;
  /** ¿Va a sonar el modelo de ESTA palabra? (asset propio o voz del sistema) */
  canSpeakModel: (word: string) => boolean;
  micGranted: boolean;           // permiso de micrófono concedido
  speaking: boolean;
  recStatus: RecStatus;
  /** ¿Hay una toma grabada en memoria lista para reproducir? */
  hasRecording: boolean;
  recognizing: boolean;          // escuchando para transcribir
  transcript: string;            // lo que el motor entendió
  matched: boolean | null;       // ¿coincide con la palabra objetivo? (null = aún sin evaluar)
  /** Propuesta SODA por fonema a partir de la transcripción (A-bis). `null`
   *  mientras no haya transcripción. La clasificación la firma el clínico. */
  sodaProposal: SodaProposal | null;
  /** Reproduce el modelo hablado (palabra/frase objetivo). */
  speakModel: (word: string) => void;
  /** Inicia/detiene grabación + reconocimiento. `targetWord` activa la comparación automática. */
  toggleRecording: (targetWord?: string, targetPhoneme?: string) => Promise<void>;
  playRecording: () => void;
  /** Borra el `.wav` de la toma en curso (A3 · Zero-PHI). Idempotente. */
  purgeRecording: () => Promise<void>;
  reset: () => void;
}

/* -------------------------------------------------------------------------- */
/*  Normalización y comparación (compartida con el mockup .dc.html)            */
/* -------------------------------------------------------------------------- */

/** minúsculas · sin tildes · sin signos. ('Ñandú' → 'nandu', '¡Chándal!' → 'chandal') */
export const normalizeSpeech = (s: string): string =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * ¿La transcripción contiene la palabra/frase objetivo?
 * Palabra suelta → coincidencia exacta del token. Frase → ≥60% de los tokens presentes.
 */
export const matchesTarget = (target: string, heard: string): boolean => {
  const t = normalizeSpeech(target);
  const h = normalizeSpeech(heard);
  if (!t || !h) return false;
  const tokens = t.split(' ').filter(Boolean);
  const present = tokens.filter(tk => h.includes(tk)).length;
  return present / tokens.length >= (tokens.length > 2 ? 0.6 : 1);
};

/* -------------------------------------------------------------------------- */
/*  Acceso a las capacidades NATIVAS de reconocimiento local (A2).             */
/*                                                                            */
/*  `expo-speech-recognition` expone estas capacidades de serie                */
/*  (`supportsOnDeviceRecognition()`, y `requiresOnDeviceRecognition` como     */
/*  opción del arranque). Antes hacían falta dos métodos añadidos a mano por   */
/*  un parche sobre el Java y el Objective-C de la librería anterior.          */
/* -------------------------------------------------------------------------- */

/* Ya no hace falta plazo de sondeo: `supportsOnDeviceRecognition()` de
 * `expo-speech-recognition` es SÍNCRONO. El plazo existía porque el método del
 * parche respondía por callback y un callback que no llegaba dejaba la puerta
 * colgada. */

/**
 * Sondeo de la capa nativa de reconocimiento. Exportado porque la pantalla de
 * comprobación de audio tiene que interrogar EXACTAMENTE la misma superficie
 * que usa el T.A.R.: un diagnóstico que preguntase por otra vía podría decir
 * «reconocimiento disponible» mientras el módulo clínico se queda mudo, que es
 * el falso positivo que esa pantalla existe para eliminar.
 */
/**
 * Sondeo de la capa nativa de reconocimiento. Exportado porque la pantalla de
 * comprobación de audio tiene que interrogar EXACTAMENTE la misma superficie
 * que usa el T.A.R.: un diagnóstico que preguntase por otra vía podría decir
 * «reconocimiento disponible» mientras el módulo clínico se queda mudo.
 *
 * Ya no hace falta ningún método parcheado: `expo-speech-recognition` expone
 * `supportsOnDeviceRecognition()` de serie, y `requiresOnDeviceRecognition` es
 * una opción declarada del arranque. Con la librería anterior estos dos
 * métodos los añadía un parche nuestro sobre el Java y el Objective-C.
 */
export const nativeRecognitionProbe = (): NativeRecognitionProbe | null => {
  if (!isRecognitionAvailable()) return null;
  return {
    isOnDeviceRecognitionAvailable: async () => supportsOnDeviceRecognition(),
    // El arranque EXIGE modo local (`requiresOnDeviceRecognition: true` en
    // `speechRecognitionBridge`), y además lanza si no puede garantizarlo en
    // vez de volver en silencio.
    startRequiresOnDevice: true,
  };
};

/** Pide RECORD_AUDIO. Fuera del hook: no depende de nada del render. */
async function requestMicPermission(): Promise<boolean> {
  const permMod = resolveLib(RN_PERMISSIONS, 'react-native-permissions');
  // Sin librería de permisos, el SO lo solicita en el primer uso; se responde
  // que sí para no bloquear el flujo (el motor de captura ya reporta si el
  // stream acaba sin abrirse).
  if (!permMod) return true;
  try {
    const { request, PERMISSIONS, RESULTS, Platform } = permMod;
    const perm =
      Platform?.OS === 'ios' ? PERMISSIONS?.IOS?.MICROPHONE : PERMISSIONS?.ANDROID?.RECORD_AUDIO;
    const res = await request(perm);
    return res === RESULTS?.GRANTED;
  } catch (_e) {
    return false;
  }
}

/**
 * ¿Hay alguna palabra del inventario T.A.R. que vaya a sonar en esta lengua?
 * Corta en la primera que sí: basta una para que el modelo hablado tenga vía.
 */
const anyTarModelSpeakable = (lang: string): boolean =>
  TAR_MODELS.some(model => canSpeakText('tutor', model.text, lang));

/* -------------------------------------------------------------------------- */
/*  Hook                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * `lang` es el idioma/variante de la SESIÓN (`state.locale.language`): decide
 * con qué voz se presenta el modelo hablado y en qué lengua transcribe el
 * reconocedor. Por defecto castellano, que es el idioma base del inventario.
 */
export function useArticulationAudio(lang: string = 'es'): ArticulationAudio {
  const [speaking, setSpeaking] = useState(false);
  const [recStatus, setRecStatus] = useState<RecStatus>('idle');
  /* A3.2 · Zero-PHI. La toma vive en MEMORIA, no en disco.
   *
   * `react-native-audio-recorder-player` escribía un `.wav` que nadie borraba:
   * la voz del paciente quedaba en el almacenamiento de la app
   * indefinidamente. No había forma de retirarlo —el proyecto no arrastra
   * ninguna librería de ficheros y el recorder no expone borrado—, así que en
   * vez de limpiar el fichero se elimina el fichero: se captura PCM en memoria
   * sobre el micrófono compartido, igual que el análisis de voz y el de
   * prosodia. Zero-PHI por diseño y no por limpieza posterior, y de paso un
   * solo motor de captura en toda la app. */
  const [hasRecording, setHasRecording] = useState(false);
  const takeRef = useRef<Float32Array | null>(null);
  const [micGranted, setMicGranted] = useState(false);
  const [recognizing, setRecognizing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [matched, setMatched] = useState<boolean | null>(null);
  const [sodaProposal, setSodaProposal] = useState<SodaProposal | null>(null);
  /** Fonema que evalúa el ítem en curso: pondera qué errores son del objetivo. */
  const targetPhonemeRef = useRef<string>('');

  /** Reserva del micrófono COMPARTIDO (un solo stream nativo en toda la app). */
  const recorderRef = useRef<SharedRecorder | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const capturingRef = useRef(false);
  const chunksRef = useRef<Float32Array[]>([]);
  const decimateRef = useRef<((raw: Float32Array) => Float32Array) | null>(null);
  const releaseSessionRef = useRef<(() => void) | null>(null);
  const playbackCtxRef = useRef<ReturnType<typeof acquireAudioContext>>(null);
  const voiceRef = useRef<any>(null);
  const targetRef = useRef<string>('');
  const langRef = useRef<string>(lang);
  langRef.current = lang;
  /** Salvaguarda del indicador «hablando» (el asset/TTS no siempre avisa). */
  const speakTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Disponibilidad de las librerías nativas. Va en ESTADO, no solo en refs: se
   * resuelve dentro del `useEffect` de montaje, o sea DESPUÉS del primer
   * render, y mutar una ref no repinta. Con las banderas solo en refs, la
   * pantalla se pintaba una única vez con `available = recognitionAvailable =
   * false` y los controles de grabación y reconocimiento —que la pantalla
   * condiciona a `audio.available || audio.recognitionAvailable`— NO LLEGABAN A
   * APARECER nunca, aunque las dos librerías estuvieran perfectamente
   * instaladas. Es el «el reconocimiento de voz no funciona» del T.A.R.
   *
   * Se conservan las refs porque los callbacks (`startRecognition`,
   * `ensureMic`) las leen sin recrearse en cada render; el estado es solo el
   * espejo que hace repintar. */
  const availableRef = useRef<boolean>(false);      // grabación
  const recognitionRef = useRef<boolean>(false);    // reconocimiento
  const [available, setAvailable] = useState(false);
  const [recognitionAvailable, setRecognitionAvailable] = useState(false);
  /* A2 · Zero-PHI. `recognitionAvailable` ya NO significa «hay motor», sino
   * «hay motor Y se puede garantizar que transcribe en el dispositivo». La
   * puerta arranca CERRADA y solo la abre `probeRecognitionCaps` si la capa
   * nativa confirma las dos capacidades: lo que no se confirma, no se asume. */
  const [recognitionBlock, setRecognitionBlock] =
    useState<RecognitionBlockReason>('no-library');
  /* Misma historia con la voz del modelo: el motor del sistema tarda un par de
   * segundos en arrancar, así que evaluarlo en el render podía quedarse
   * congelado en el «no» del arranque y dejar puesto para siempre el aviso de
   * «sin voz disponible». Se suscribe a los cambios de estado.
   *
   * Se pregunta POR EL BANCO T.A.R. y no por `canSpeak()` a secas: aquel
   * respondía «sí» en cuanto había CUALQUIER locución empaquetada en la app, y
   * el banco de recortes es hoy solo `es-DO`. En sesión castellana el modelo
   * hablado del T.A.R. depende del sintetizador del sistema, así que si ese no
   * está, la respuesta honesta es «no» — y era justo el caso en el que la
   * pantalla decía que sí y luego no sonaba nada. */
  const [modelVoiceAvailable, setModelVoiceAvailable] = useState(() =>
    anyTarModelSpeakable(lang),
  );

  /* -------------------------- purga de la toma (A3) ------------------------- */
  /*  Con la captura en memoria, «purgar» es soltar la referencia: no queda      */
  /*  fichero que borrar ni permiso de disco que pedir, y no hay ventana en la   */
  /*  que la voz del paciente sobreviva a la prueba.                             */
  const purgeRecording = useCallback(async () => {
    takeRef.current = null;
    setHasRecording(false);
  }, []);

  /**
   * Reserva el micrófono compartido y se suscribe, UNA sola vez. Es PEREZOSA a
   * propósito: hasta que no se llama, el T.A.R. no toca el micrófono.
   *
   * Antes esto vivía en el `useEffect` de montaje, y ese era el fallo. El
   * stream nativo se abre en el CONSTRUCTOR de `AudioRecorder`, así que pedir
   * el micrófono al ENTRAR en la pantalla lo abría antes de que nadie hubiera
   * pedido RECORD_AUDIO: Oboe no podía abrir la entrada, el objeto quedaba
   * cacheado sin stream y —al ser el micrófono COMPARTIDO— el análisis de voz
   * y el de prosodia heredaban después un micrófono muerto. Ahora se pide
   * cuando ya hay permiso, que es cuando se puede abrir de verdad.
   */
  const ensureRecorder = useCallback((): SharedRecorder | null => {
    if (recorderRef.current) return recorderRef.current;
    const shared = acquireRecorder();
    if (!shared) return null;
    recorderRef.current = shared;
    unsubscribeRef.current = shared.subscribe(raw => {
      if (!capturingRef.current) return;
      try {
        const ds = decimateRef.current ? decimateRef.current(raw) : null;
        if (ds && ds.length) chunksRef.current.push(ds);
      } catch (_e) {
        /* un bloque corrupto no debe tumbar la captura */
      }
    });
    return shared;
  }, []);

  /* ---------------------------- init libs ----------------------------- */
  useEffect(() => {
    // 1) Grabación en memoria sobre el micrófono compartido. Solo se comprueba
    //    que el binario TRAE motor de captura: la reserva es perezosa (ver
    //    `ensureRecorder`), porque abrirlo sin permiso lo deja muerto.
    if (isRecorderAvailable()) {
      availableRef.current = true;
      setAvailable(true);
    }

    // 2) Reconocimiento de voz (expo-speech-recognition, vía el puente)
    const Voice: SpeechRecognizer | null = createSpeechRecognizer();
    if (Voice) {
      voiceRef.current = Voice;
      /* NO se activa aquí. Antes bastaba con que la librería existiera, y ese
       * era justamente el fallo: el reconocedor del sistema es de SERVIDOR por
       * defecto, así que «hay librería» acababa significando «la voz del niño
       * viaja a Apple o a Google». Ahora la decisión la toma la puerta, tras
       * interrogar a la capa nativa. */
      Voice.onSpeechStart = () => setRecognizing(true);
      const handleResults = (e: any) => {
        const text: string = (e?.value && e.value[0]) || '';
        if (!text) return;
        setTranscript(text);
        if (targetRef.current) {
          setMatched(matchesTarget(targetRef.current, text));
          // A-bis: de «coincide / no coincide» a QUÉ fonema falló y de qué tipo.
          setSodaProposal(proposeSoda(targetRef.current, text, targetPhonemeRef.current));
        }
      };
      Voice.onSpeechPartialResults = handleResults;
      Voice.onSpeechResults = handleResults;
      Voice.onSpeechEnd = () => setRecognizing(false);
      Voice.onSpeechError = () => setRecognizing(false);
    }

    return () => {
      // Al salir de la pantalla la toma deja de hacer falta: se retira.
      void purgeRecording();
      if (speakTimerRef.current) clearTimeout(speakTimerRef.current);
      try {
        stopSpeaking();
      } catch (_e) {
        /* noop */
      }
      capturingRef.current = false;
      chunksRef.current = [];
      takeRef.current = null;
      releaseSessionRef.current?.();
      releaseSessionRef.current = null;
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
      recorderRef.current?.release();
      recorderRef.current = null;
      if (playbackCtxRef.current) {
        playbackCtxRef.current = null;
        releaseAudioContext();
      }
      try {
        voiceRef.current?.destroy?.().then?.(() => voiceRef.current?.removeAllListeners?.());
      } catch (_e) {
        /* noop */
      }
    };
  }, [purgeRecording]);

  /* A2 · PUERTA DE RECONOCIMIENTO. Se interroga a la capa nativa por sus
   * capacidades y se decide. Depende de la lengua de sesión porque el modelo
   * local existe POR LENGUA: un dispositivo puede tener castellano descargado
   * y no gallego, y eso cambia la respuesta.
   *
   * Si el sondeo se queda a medias (pantalla desmontada), no se toca estado:
   * la puerta se queda como estaba, que es cerrada. */
  useEffect(() => {
    let alive = true;
    const locale = RECOGNITION_LOCALE[lang] ?? RECOGNITION_FALLBACK;
    void (async () => {
      // Se exige TAMBIÉN la librería JS: es la que arranca y entrega los
      // resultados. Con el módulo nativo presente pero la librería sin cargar,
      // abrir la puerta prometería una transcripción que nadie puede producir.
      const probe = voiceRef.current ? nativeRecognitionProbe() : null;
      const caps = await probeRecognitionCaps(probe, locale);
      const decision = resolveRecognitionMode(caps);
      if (!alive) return;
      recognitionRef.current = decision.mode === 'on-device';
      setRecognitionAvailable(decision.mode === 'on-device');
      setRecognitionBlock(decision.reason);
    })();
    return () => {
      alive = false;
    };
  }, [lang]);

  /* El motor de voz del sistema se inicializa de forma asíncrona: sin esta
   * suscripción la pantalla no se entera de que ya está listo. Depende de la
   * lengua porque la vía disponible cambia con ella (una sesión dominicana
   * tiene recortes propios; una castellana, hoy, solo el motor del sistema). */
  useEffect(() => {
    const refresh = () => setModelVoiceAvailable(anyTarModelSpeakable(lang));
    refresh();
    return onVoiceStatusChange(refresh);
  }, [lang]);

  /** ¿Sonará el modelo de esta palabra concreta? */
  const canSpeakModel = useCallback(
    (word: string) => canSpeakText('tutor', tarModelByLang(word), langRef.current),
    [],
  );

  /* --------------------------- permiso mic ---------------------------- */
  const ensureMic = useCallback(async (): Promise<boolean> => {
    const ok = await requestMicPermission();
    setMicGranted(ok);
    // El micrófono es COMPARTIDO y su stream se abre en el CONSTRUCTOR: hay que
    // decirle que ya hay permiso antes de que nadie intente abrirlo, o nacería
    // sin stream y dejaría mudos también al análisis de voz y al de prosodia.
    setRecorderPermissionGranted(ok);
    return ok;
  }, []);

  /* --------------------------- modelo hablado -------------------------- */
  /**
   * Presenta el modelo con la voz de la lengua de sesión. `@/Voice` elige la
   * mejor vía disponible (recorte neuronal → voz verificada del sistema) y es
   * silencioso si no hay ninguna: en ese caso el clínico pronuncia el modelo,
   * que es la degradación prevista del módulo.
   *
   * El estilo es `tutor`, el mismo con el que el pipeline sintetiza el resto
   * de locuciones habladas de la app: la palabra tiene asset propio en cuanto
   * el corpus se sintetiza (ver `TAR_MODELS` en `viaVoiceConsignas.ts`).
   *
   * LENGUA: se resuelve con `speakLocalized` a partir del banco T.A.R., que es
   * de fonología CASTELLANA (`es` y su variante `es-DO`). Antes se le pasaba a
   * `speak()` la lengua de sesión a secas, así que una sesión gallega pedía voz
   * gallega para una palabra castellana: si el recorte faltaba, el modelo salía
   * con acento gallego leyendo castellano. Ahora una sesión gl/eu locuta el
   * modelo castellano CON VOZ CASTELLANA y la pantalla lo advierte; la sesión
   * dominicana sigue oyéndolo con su voz, que es la misma lengua.
   */
  const speakModel = useCallback((word: string) => {
    try {
      setSpeaking(true);
      speakLocalized('tutor', tarModelByLang(word), langRef.current);
      // Salvaguarda: ni el reproductor de recortes ni el TTS garantizan un
      // evento de fin, y el indicador no puede quedarse encendido.
      if (speakTimerRef.current) clearTimeout(speakTimerRef.current);
      speakTimerRef.current = setTimeout(() => setSpeaking(false), 2500);
    } catch (_e) {
      setSpeaking(false);
    }
  }, []);

  /* ------------------- grabación + reconocimiento --------------------- */
  const startRecognition = useCallback(async (targetWord?: string, targetPhoneme?: string) => {
    targetRef.current = targetWord ?? '';
    targetPhonemeRef.current = targetPhoneme ?? '';
    setTranscript('');
    setMatched(null);
    setSodaProposal(null);
    if (!voiceRef.current) return;
    const locale = RECOGNITION_LOCALE[langRef.current] ?? RECOGNITION_FALLBACK;
    try {
      await voiceRef.current?.start?.(locale);
      setRecognizing(true);
    } catch (_e) {
      setRecognizing(false);
    }
  }, []);

  const stopRecognition = useCallback(async () => {
    try {
      await voiceRef.current?.stop?.();
    } catch (_e) {
      /* noop */
    }
    setRecognizing(false);
  }, []);

  const toggleRecording = useCallback(
    async (targetWord?: string, targetPhoneme?: string) => {
      // --- detener ---
      if (recStatus === 'recording') {
        try {
          recorderRef.current?.stop();
        } catch (_e) {
          /* noop */
        }
        releaseSessionRef.current?.();
        releaseSessionRef.current = null;
        // Los bloques llegan por el emisor de eventos, o sea en un turno
        // posterior del hilo JS: sin esta espera se perdería la cola de la
        // emisión, que es justo el final de la palabra repetida.
        //
        // `capturingRef` SIGUE EN TRUE durante el vaciado. Ponerlo a false
        // antes —como estaba— hacía que el consumidor de bloques descartase
        // exactamente los que esta espera pretendía recoger: el comentario de
        // arriba describía la intención y la línea siguiente la anulaba. En el
        // T.A.R. eso se lleva el FINAL de la palabra repetida, que es donde la
        // clasificación SODA busca omisiones y distorsiones de la consonante
        // final, y deja sin audio cualquier repetición más corta que un bloque
        // (~100 ms). Mismo fallo y mismo arreglo que en el análisis acústico y
        // la prosodia (ver `voiceMicAdapter`).
        await new Promise<void>(resolve => setTimeout(resolve, TAIL_DRAIN_MS));
        capturingRef.current = false;
        const total = chunksRef.current.reduce((a, c) => a + c.length, 0);
        const pcm = new Float32Array(total);
        let off = 0;
        for (const c of chunksRef.current) {
          pcm.set(c, off);
          off += c.length;
        }
        chunksRef.current = [];
        decimateRef.current = null;
        takeRef.current = total > 0 ? pcm : null;
        setHasRecording(total > 0);
        await stopRecognition();

        // Si hay grabación de audio, evaluar propuesta SODA
        if (total > 0 && targetWord) {
          let energySum = 0;
          for (let i = 0; i < pcm.length; i++) energySum += pcm[i] * pcm[i];
          const rms = Math.sqrt(energySum / pcm.length);
          // Forma funcional: `sodaProposal` se lee del estado VIGENTE en vez de
          // del cierre. Leyéndolo del cierre, la propuesta quedaba fijada en el
          // render en que se creó el callback y una toma posterior podía volver
          // a proponer sobre una propuesta ya emitida. El `??` además evita
          // recalcular `proposeSoda` cuando ya la hay.
          if (rms > 0.003) {
            setSodaProposal(prev => prev ?? proposeSoda(targetWord, targetWord, targetPhoneme));
          }
        }

        setRecStatus(availableRef.current ? 'ready' : 'idle');
        return;
      }

      // --- iniciar ---
      if (!availableRef.current && !recognitionRef.current) return; // sin motores: SODA manual
      const ok = await ensureMic();
      if (!ok) return;

      // La sesión de grabación se reserva ANTES de abrir cualquier micrófono, y
      // FUERA del `if` de la captura en memoria. El reconocedor nativo también
      // abre el micrófono: en la vía «solo reconocimiento» (dispositivo sin
      // motor de captura, SODA manual) el T.A.R. escuchaba sin que constara
      // ninguna grabación reservada. Eso no afectaba a la transcripción, pero
      // dejaba la escucha invisible para el único punto por el que el resto de
      // la app se entera de que el micrófono está abierto
      // (`onRecordingSessionChange`) — y con él, para el permiso de ruido del
      // periférico de refuerzo (docs/design/integracion-lua.md §3.1).
      releaseSessionRef.current?.();
      releaseSessionRef.current = acquireRecordingSession();

      // reconocimiento (no bloqueante)
      startRecognition(targetWord, targetPhoneme);

      // grabación en memoria
      if (availableRef.current) {
        try {
          chunksRef.current = [];
          decimateRef.current = createDecimator3();
          takeRef.current = null;
          setHasRecording(false);
          capturingRef.current = true;
          // Reserva PEREZOSA: el permiso acaba de concederse, así que este es
          // el primer momento en que el stream nativo se puede abrir de verdad.
          ensureRecorder()?.start();
          setRecStatus('recording');
        } catch (_e) {
          capturingRef.current = false;
          // La toma no arrancó: se aborta el intento completo en vez de dejar
          // al reconocedor escuchando sin grabación que lo acompañe, y se
          // suelta la sesión que se acaba de reservar.
          void stopRecognition();
          releaseSessionRef.current?.();
          releaseSessionRef.current = null;
          setRecStatus('idle');
        }
      } else {
        // solo reconocimiento disponible: usamos 'recording' como estado de escucha
        setRecStatus('recording');
      }
    },
    [recStatus, ensureMic, ensureRecorder, startRecognition, stopRecognition],
  );

  const playRecording = useCallback(() => {
    const pcm = takeRef.current;
    if (!pcm || !pcm.length) return;
    // Reproducción sobre el contexto COMPARTIDO: abrir uno propio dejaría mudo
    // al resto de la app en Android (Oboe exclusivo), que es el fallo que
    // documenta `docs/design/arquitectura-audio.md`.
    // Si el contexto se sustituyó tras una recuperación, se apunta al vivo sin
    // pedir otra reserva: la de esta pantalla ya está contada.
    const live = peekAudioContext();
    if (playbackCtxRef.current && live && playbackCtxRef.current !== live) {
      playbackCtxRef.current = live;
    }
    if (!playbackCtxRef.current) playbackCtxRef.current = acquireAudioContext();
    const ctx = playbackCtxRef.current;
    if (!ctx) return;
    resumeAudioContext();
    try {
      // Nivel de ESCUCHA, no de análisis: la toma llega a ~−30 dBFS por el modo
      // «measurement» de la captura y en el altavoz de una tableta es casi
      // inaudible. Se normaliza el pico solo para reproducir; el análisis sigue
      // corriendo sobre el PCM crudo (ver `@/Audio/playbackGain`).
      const gain = playbackNormalizationGain(pcm);
      // Re-expansión ×3 (16 kHz → 48 kHz) por interpolación lineal, para que
      // suene a la frecuencia del contexto de reproducción.
      const up = new Float32Array(pcm.length * DECIMATION);
      for (let i = 0; i < pcm.length; i++) {
        const a = clampSample(pcm[i] * gain);
        const next = i + 1 < pcm.length ? pcm[i + 1] : pcm[i];
        const b = clampSample(next * gain);
        const base = i * DECIMATION;
        up[base] = a;
        up[base + 1] = a + (b - a) / 3;
        up[base + 2] = a + (2 * (b - a)) / 3;
      }
      const buffer = ctx.createBuffer(1, up.length, SAMPLE_RATE * DECIMATION);
      try {
        buffer.copyToChannel(up, 0);
      } catch (_e) {
        buffer.getChannelData(0).set(up);
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start();
    } catch (_e) {
      /* noop */
    }
  }, []);

  const reset = useCallback(() => {
    void purgeRecording();
    setRecStatus('idle');
    setTranscript('');
    setMatched(null);
    setSodaProposal(null);
    setRecognizing(false);
    setSpeaking(false);
    if (speakTimerRef.current) clearTimeout(speakTimerRef.current);
    try {
      stopSpeaking();
    } catch (_e) {
      /* noop */
    }
    try {
      capturingRef.current = false;
      recorderRef.current?.stop();
    } catch (_e) {
      /* noop */
    }
    try {
      voiceRef.current?.cancel?.();
    } catch (_e) {
      /* noop */
    }
  }, [purgeRecording]);

  return {
    available,
    recognitionAvailable,
    recognitionOnDevice: recognitionAvailable,
    recognitionBlockReason: recognitionBlock,
    recognitionBlockLabel: recognitionBlockLabel(recognitionBlock),
    modelVoiceAvailable,
    canSpeakModel,
    micGranted,
    speaking,
    recStatus,
    hasRecording,
    recognizing,
    transcript,
    matched,
    sodaProposal,
    speakModel,
    toggleRecording,
    playRecording,
    purgeRecording,
    reset,
  };
}
