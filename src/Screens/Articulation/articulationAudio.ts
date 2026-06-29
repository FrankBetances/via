import { useCallback, useEffect, useRef, useState } from 'react';

/* -------------------------------------------------------------------------- */
/*  Adaptador de audio del T.A.R.                                              */
/*  Tres capacidades, todas con DEGRADACIÓN (principio VIA+): si la librería   */
/*  nativa no está instalada o falta el permiso, el módulo sigue funcionando   */
/*  (el clínico clasifica SODA manualmente) y la bandera correspondiente queda */
/*  en `false`, de modo que la UI muestra el chip de «modo limitado».          */
/*                                                                              */
/*   1. Modelo hablado (TTS)         → `react-native-tts`                       */
/*   2. Grabación de la repetición   → `react-native-audio-recorder-player`     */
/*      (Android: MediaRecorder · iOS: AVAudioRecorder · grabación + playback)  */
/*   3. Reconocimiento de voz        → `@react-native-voice/voice`              */
/*      (Android: SpeechRecognizer · iOS: SFSpeechRecognizer · es-ES)           */
/*   ·  Permisos de micrófono        → `react-native-permissions`               */
/* -------------------------------------------------------------------------- */

/** require opcional: el nombre va en variable para que el bundler no falle si la lib no existe. */
const optionalRequire = (name: string): any => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    return require(name);
  } catch (_e) {
    return null;
  }
};

/* ───────────────────────────────────────────────────────────────────────────
 * ACTIVAR AUDIO REAL (recomendado para producción)
 * Por defecto se resuelve con `require` dinámico: el build NO se rompe si las
 * librerías no están instaladas y el módulo funciona en modo limitado (SODA
 * manual). Para integrar TTS + grabación + reconocimiento reales:
 *   1) instala las deps (ver LEEME §5) y `cd ios && pod install`.
 *   2) descomenta las 4 líneas `import` y las 4 asignaciones de abajo.
 * El import LITERAL garantiza que Metro EMPAQUETE los módulos nativos (un
 * require dinámico podría no incluirlos en el bundle aunque estén instalados).
 * ─────────────────────────────────────────────────────────────────────────── */
// import TtsLib from 'react-native-tts';
// import AudioRecorderPlayerLib from 'react-native-audio-recorder-player';
// import VoiceLib from '@react-native-voice/voice';
// import * as PermissionsLib from 'react-native-permissions';
let RN_TTS: any = null;
let RN_RECORDER: any = null;
let RN_VOICE: any = null;
let RN_PERMISSIONS: any = null;
// RN_TTS = TtsLib;
// RN_RECORDER = AudioRecorderPlayerLib;
// RN_VOICE = VoiceLib;
// RN_PERMISSIONS = PermissionsLib;

/** Resuelve una lib: usa el import literal (si está activado) o cae al require dinámico. */
const resolveLib = (literal: any, name: string): any => literal ?? optionalRequire(name);

export type RecStatus = 'idle' | 'recording' | 'ready';

export interface ArticulationAudio {
  available: boolean;            // hay motor de grabación
  recognitionAvailable: boolean; // hay motor de reconocimiento de voz
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

export function useArticulationAudio(): ArticulationAudio {
  const [speaking, setSpeaking] = useState(false);
  const [recStatus, setRecStatus] = useState<RecStatus>('idle');
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [micGranted, setMicGranted] = useState(false);
  const [recognizing, setRecognizing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [matched, setMatched] = useState<boolean | null>(null);

  const ttsRef = useRef<any>(null);
  const recorderRef = useRef<any>(null);
  const voiceRef = useRef<any>(null);
  const targetRef = useRef<string>('');

  const availableRef = useRef<boolean>(false);      // grabación
  const recognitionRef = useRef<boolean>(false);    // reconocimiento

  /* ---------------------------- init libs ----------------------------- */
  useEffect(() => {
    // 1) TTS
    const ttsMod = resolveLib(RN_TTS, 'react-native-tts');
    if (ttsMod) {
      ttsRef.current = ttsMod.default ?? ttsMod;
      try {
        ttsRef.current.setDefaultLanguage?.('es-ES');
        ttsRef.current.setDefaultRate?.(0.42);
      } catch (_e) {
        /* noop */
      }
    }

    // 2) Grabación + playback
    const recMod = resolveLib(RN_RECORDER, 'react-native-audio-recorder-player');
    const RecorderPlayer = recMod?.default ?? recMod;
    if (RecorderPlayer) {
      try {
        recorderRef.current = typeof RecorderPlayer === 'function' ? new RecorderPlayer() : RecorderPlayer;
        availableRef.current = true;
      } catch (_e) {
        availableRef.current = false;
      }
    }

    // 3) Reconocimiento de voz
    const voiceMod = resolveLib(RN_VOICE, '@react-native-voice/voice');
    const Voice = voiceMod?.default ?? voiceMod;
    if (Voice) {
      voiceRef.current = Voice;
      recognitionRef.current = true;
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
      try {
        ttsRef.current?.stop?.();
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

  /* ---------------------------- TTS modelo ---------------------------- */
  const speakModel = useCallback((word: string) => {
    const tts = ttsRef.current;
    if (!tts) return; // sin TTS: el clínico pronuncia el modelo manualmente
    try {
      tts.stop?.();
      setSpeaking(true);
      const onFinish = () => setSpeaking(false);
      tts.addEventListener?.('tts-finish', onFinish);
      tts.addEventListener?.('tts-cancel', onFinish);
      tts.speak?.(word);
      setTimeout(() => setSpeaking(false), 2500); // salvaguarda
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
    try {
      await voiceRef.current?.start?.('es-ES');
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
    available: availableRef.current,
    recognitionAvailable: recognitionRef.current,
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
