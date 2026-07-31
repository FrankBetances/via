import { useCallback, useEffect, useRef, useState } from 'react';

import {
  canSpeak,
  onVoiceStatusChange,
  speakLocalized,
  stopSpeaking,
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
/*   2. Grabación de la repetición   → `react-native-audio-recorder-player`     */
/*      (Android: MediaRecorder · iOS: AVAudioRecorder · grabación + playback)  */
/*   3. Reconocimiento de voz        → `@react-native-voice/voice`              */
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
type OptionalLibName =
  | 'react-native-audio-recorder-player'
  | '@react-native-voice/voice'
  | 'react-native-permissions';

const optionalRequire = (name: OptionalLibName): any => {
  try {
    switch (name) {
      case 'react-native-audio-recorder-player':
        return require('react-native-audio-recorder-player');
      case '@react-native-voice/voice':
        return require('@react-native-voice/voice');
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
  gl: 'gl-ES',
  eu: 'eu-ES',
};

/** Lengua a la que degrada el reconocedor si no hay modelo para la pedida. */
const RECOGNITION_FALLBACK = 'es-ES';

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
// import AudioRecorderPlayerLib from 'react-native-audio-recorder-player';
// import VoiceLib from '@react-native-voice/voice';
// import * as PermissionsLib from 'react-native-permissions';
let RN_RECORDER: any = null;
let RN_VOICE: any = null;
let RN_PERMISSIONS: any = null;
// RN_RECORDER = AudioRecorderPlayerLib;
// RN_VOICE = VoiceLib;
// RN_PERMISSIONS = PermissionsLib;

/** Resuelve una lib: usa el import literal (si está activado) o cae al require dinámico. */
const resolveLib = (literal: any, name: OptionalLibName): any => literal ?? optionalRequire(name);

export type RecStatus = 'idle' | 'recording' | 'ready';

export interface ArticulationAudio {
  available: boolean;            // hay motor de grabación
  recognitionAvailable: boolean; // hay motor de reconocimiento de voz
  /** Hay alguna vía para el modelo hablado (recorte neuronal o voz del sistema). */
  modelVoiceAvailable: boolean;
  micGranted: boolean;           // permiso de micrófono concedido
  speaking: boolean;
  recStatus: RecStatus;
  audioUri: string | null;
  recognizing: boolean;          // escuchando para transcribir
  transcript: string;            // lo que el motor entendió
  matched: boolean | null;       // ¿coincide con la palabra objetivo? (null = aún sin evaluar)
  /** Reproduce el modelo hablado (palabra/frase objetivo). */
  speakModel: (word: string) => void;
  /** Inicia/detiene grabación + reconocimiento. `targetWord` activa la comparación automática. */
  toggleRecording: (targetWord?: string) => Promise<void>;
  playRecording: () => void;
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
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [micGranted, setMicGranted] = useState(false);
  const [recognizing, setRecognizing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [matched, setMatched] = useState<boolean | null>(null);

  const recorderRef = useRef<any>(null);
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
  /* Misma historia con la voz del modelo: el motor del sistema tarda un par de
   * segundos en arrancar, así que `canSpeak()` evaluado en el render podía
   * quedarse congelado en el «no» del arranque y dejar puesto para siempre el
   * aviso de «sin voz disponible». Se suscribe a los cambios de estado. */
  const [modelVoiceAvailable, setModelVoiceAvailable] = useState(canSpeak);

  /* ---------------------------- init libs ----------------------------- */
  useEffect(() => {
    // 1) Grabación + playback
    const recMod = resolveLib(RN_RECORDER, 'react-native-audio-recorder-player');
    const RecorderPlayer = recMod?.default ?? recMod;
    if (RecorderPlayer) {
      try {
        recorderRef.current = typeof RecorderPlayer === 'function' ? new RecorderPlayer() : RecorderPlayer;
        availableRef.current = true;
        setAvailable(true);
      } catch (_e) {
        availableRef.current = false;
        setAvailable(false);
      }
    }

    // 2) Reconocimiento de voz
    const voiceMod = resolveLib(RN_VOICE, '@react-native-voice/voice');
    const Voice = voiceMod?.default ?? voiceMod;
    if (Voice) {
      voiceRef.current = Voice;
      recognitionRef.current = true;
      setRecognitionAvailable(true);
      Voice.onSpeechStart = () => setRecognizing(true);
      const handleResults = (e: any) => {
        const text: string = (e?.value && e.value[0]) || '';
        if (!text) return;
        setTranscript(text);
        if (targetRef.current) setMatched(matchesTarget(targetRef.current, text));
      };
      Voice.onSpeechPartialResults = handleResults;
      Voice.onSpeechResults = handleResults;
      Voice.onSpeechEnd = () => setRecognizing(false);
      Voice.onSpeechError = () => setRecognizing(false);
    }

    return () => {
      if (speakTimerRef.current) clearTimeout(speakTimerRef.current);
      try {
        stopSpeaking();
      } catch (_e) {
        /* noop */
      }
      try {
        recorderRef.current?.stopRecorder?.();
        recorderRef.current?.stopPlayer?.();
      } catch (_e) {
        /* noop */
      }
      try {
        voiceRef.current?.destroy?.().then?.(() => voiceRef.current?.removeAllListeners?.());
      } catch (_e) {
        /* noop */
      }
    };
  }, []);

  /* El motor de voz del sistema se inicializa de forma asíncrona: sin esta
   * suscripción la pantalla no se entera de que ya está listo. */
  useEffect(() => {
    setModelVoiceAvailable(canSpeak());
    return onVoiceStatusChange(() => setModelVoiceAvailable(canSpeak()));
  }, []);

  /* --------------------------- permiso mic ---------------------------- */
  const ensureMic = useCallback(async (): Promise<boolean> => {
    const permMod = resolveLib(RN_PERMISSIONS, 'react-native-permissions');
    if (!permMod) {
      // sin librería de permisos: el SO lo solicita en el primer uso
      setMicGranted(availableRef.current || recognitionRef.current);
      return availableRef.current || recognitionRef.current;
    }
    try {
      const { request, PERMISSIONS, RESULTS, Platform } = permMod;
      const perm = Platform?.OS === 'ios' ? PERMISSIONS?.IOS?.MICROPHONE : PERMISSIONS?.ANDROID?.RECORD_AUDIO;
      const res = await request(perm);
      const ok = res === RESULTS?.GRANTED;
      setMicGranted(ok);
      return ok;
    } catch (_e) {
      setMicGranted(false);
      return false;
    }
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
  const startRecognition = useCallback(async (targetWord?: string) => {
    if (!recognitionRef.current) return;
    targetRef.current = targetWord ?? '';
    setTranscript('');
    setMatched(null);
    const locale = RECOGNITION_LOCALE[langRef.current] ?? RECOGNITION_FALLBACK;
    try {
      await voiceRef.current?.start?.(locale);
      setRecognizing(true);
    } catch (_e) {
      // El dispositivo no trae ese modelo de reconocimiento (habitual en
      // gl/eu y en variantes como es-DO). Se reintenta con la lengua base
      // antes de rendirse: transcribir con acento ajeno sigue siendo más útil
      // que no transcribir, y la clasificación SODA la firma el clínico.
      if (locale === RECOGNITION_FALLBACK) {
        setRecognizing(false);
        return;
      }
      try {
        await voiceRef.current?.start?.(RECOGNITION_FALLBACK);
        setRecognizing(true);
      } catch (_e2) {
        setRecognizing(false);
      }
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
    async (targetWord?: string) => {
      // --- detener ---
      if (recStatus === 'recording') {
        try {
          const uri = await recorderRef.current?.stopRecorder?.();
          if (uri) setAudioUri(typeof uri === 'string' ? uri : uri?.uri ?? null);
        } catch (_e) {
          /* noop */
        }
        await stopRecognition();
        setRecStatus(availableRef.current ? 'ready' : 'idle');
        return;
      }

      // --- iniciar ---
      if (!availableRef.current && !recognitionRef.current) return; // sin motores: SODA manual
      const ok = await ensureMic();
      if (!ok) return;

      // reconocimiento (no bloqueante)
      startRecognition(targetWord);

      // grabación
      if (availableRef.current) {
        try {
          await recorderRef.current?.startRecorder?.();
          setRecStatus('recording');
        } catch (_e) {
          setRecStatus('idle');
        }
      } else {
        // solo reconocimiento disponible: usamos 'recording' como estado de escucha
        setRecStatus('recording');
      }
    },
    [recStatus, ensureMic, startRecognition, stopRecognition],
  );

  const playRecording = useCallback(() => {
    if (!audioUri || !recorderRef.current) return;
    try {
      recorderRef.current.startPlayer?.(audioUri);
      recorderRef.current.addPlayBackListener?.((e: any) => {
        if (e?.currentPosition >= e?.duration) {
          recorderRef.current?.stopPlayer?.();
          recorderRef.current?.removePlayBackListener?.();
        }
      });
    } catch (_e) {
      /* noop */
    }
  }, [audioUri]);

  const reset = useCallback(() => {
    setRecStatus('idle');
    setAudioUri(null);
    setTranscript('');
    setMatched(null);
    setRecognizing(false);
    setSpeaking(false);
    if (speakTimerRef.current) clearTimeout(speakTimerRef.current);
    try {
      stopSpeaking();
    } catch (_e) {
      /* noop */
    }
    try {
      recorderRef.current?.stopRecorder?.();
      recorderRef.current?.stopPlayer?.();
    } catch (_e) {
      /* noop */
    }
    try {
      voiceRef.current?.cancel?.();
    } catch (_e) {
      /* noop */
    }
  }, []);

  return {
    available,
    recognitionAvailable,
    modelVoiceAvailable,
    micGranted,
    speaking,
    recStatus,
    audioUri,
    recognizing,
    transcript,
    matched,
    speakModel,
    toggleRecording,
    playRecording,
    reset,
  };
}
