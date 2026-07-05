import { useCallback, useEffect, useRef, useState } from 'react';
import {
  VoiceFormants,
  VoiceQuality,
  VoiceSource,
} from '@/Models/VoiceAnalysis/VoiceAnalysis';
import { roundTo } from '@/Helpers/numeric';

/* -------------------------------------------------------------------------- */
/*  Hook del análisis acústico de voz — SOLO captura real.                     */
/*                                                                            */
/*  Flujo por TOMAS: cada grabación se guarda como una toma (PCM crudo) en    */
/*  una lista; el clínico puede grabar varias, reproducirlas y elegir cuál    */
/*  analizar. La parada de la grabación solo devuelve el audio (rápida); el   */
/*  análisis pesado es un paso aparte y asíncrono. Ambos van protegidos por   */
/*  timeout para que la pantalla nunca quede colgada en «grabando» si el      */
/*  motor nativo no responde (bug histórico de esta pantalla).                */
/*                                                                            */
/*  El modo demostración se eliminó: sin micrófono disponible la pantalla     */
/*  informa del problema y no genera datos sintéticos (una app clínica no     */
/*  debe producir resultados simulados). El adaptador se registra en el       */
/*  montaje de la pantalla (`registerVoiceMicAdapter`, basado en              */
/*  react-native-audio-api).                                                  */
/* -------------------------------------------------------------------------- */

export interface VoiceLiveFrame {
  f0: number | null; // Hz de la ventana en vivo (null = ventana sorda)
  rms: number; // nivel RMS 0..1
}

export interface VoiceMicResult {
  f0s: number[]; // Hz por frame de voz
  amplitudes: number[]; // RMS por frame de voz
  hnrs?: number[]; // dB por frame (opcional; si no, se estima)
  formants?: VoiceFormants | null; // F1–F3 por LPC (null = no estimables)
}

export interface VoiceMicAdapter {
  /** Frecuencia de muestreo del PCM que devuelve `stopRecording`. */
  sampleRate: number;
  startRecording: (onLive?: (frame: VoiceLiveFrame) => void) => Promise<void>;
  /** Para la captura y devuelve el PCM crudo SIN analizar (debe ser rápido). */
  stopRecording: () => Promise<Float32Array>;
  /** Análisis acústico de un PCM ya grabado (asíncrono, puede tardar). */
  analyse: (pcm: Float32Array) => Promise<VoiceMicResult>;
  /** Reproduce un PCM grabado; `onEnded` se llama al terminar por sí solo. */
  play: (pcm: Float32Array, onEnded: () => void) => void;
  stopPlayback: () => void;
}

let micAdapter: VoiceMicAdapter | null = null;
/* La pantalla registra el adaptador en un `useEffect` (tras el primer render);
 * sin notificación el hook nunca se enteraría y `hasMic` quedaría `false` para
 * siempre, dejando el botón «Grabar voz» deshabilitado. */
const micListeners = new Set<() => void>();
export const setVoiceMicAdapter = (adapter: VoiceMicAdapter | null) => {
  micAdapter = adapter;
  micListeners.forEach(listener => listener());
};

/* -------------------------------------------------------------------------- */
/*  Tipos de estado de la captura                                              */
/* -------------------------------------------------------------------------- */

export type CapturePhase =
  | 'idle'
  | 'recording'
  | 'analyzing'
  | 'analyzed'
  | 'insufficient'
  | 'error';

export interface AcousticResult {
  f0: number;
  jitter: number;
  shimmer: number;
  hnr: number;
  formants: VoiceFormants;
  quality: VoiceQuality;
}

/** Una grabación (toma) lista para reproducir y/o analizar. */
export interface VoiceTake {
  id: number;
  pcm: Float32Array;
  durationSec: number;
  recordedAt: Date;
}

const DURATION_MS = 5000;
/** Ventanas sonoras mínimas para un resultado clínicamente interpretable. */
const MIN_VOICED_FRAMES = 8;
/** Duración mínima de una toma para conservarla en la lista. */
const MIN_TAKE_SEC = 0.8;
/** Si la parada nativa no responde en este plazo, se aborta con error. */
const STOP_TIMEOUT_MS = 5000;
/** Presupuesto máximo del análisis de una toma. */
const ANALYSE_TIMEOUT_MS = 20000;

const withTimeout = <T,>(promise: Promise<T>, ms: number, message: string): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      value => {
        clearTimeout(t);
        resolve(value);
      },
      err => {
        clearTimeout(t);
        reject(err);
      },
    );
  });

/* -------------------------------------------------------------------------- */
/*  Cálculo de parámetros a partir de las series temporales                    */
/* -------------------------------------------------------------------------- */

const round = (v: number, d = 2) => roundTo(v, d);

/**
 * Parámetros acústicos desde las series por ventana. Devuelve `null` si la
 * captura no tiene suficientes ventanas sonoras: la pantalla pide repetir la
 * emisión (antes se devolvían valores simulados, eliminado con el modo demo).
 */
const computeParams = (r: VoiceMicResult): AcousticResult | null => {
  const { f0s, amplitudes: amps, hnrs, formants } = r;
  const valid = f0s.filter(f => f > 100 && f < 500);
  if (valid.length < MIN_VOICED_FRAMES || !formants) return null;

  const avgF0 = valid.reduce((a, b) => a + b, 0) / valid.length;

  // Jitter (perturbación relativa media de periodos)
  let jSum = 0;
  let pSum = 0;
  for (let i = 0; i < valid.length - 1; i++) {
    jSum += Math.abs(1 / valid[i] - 1 / valid[i + 1]);
    pSum += 1 / valid[i];
  }
  pSum += 1 / valid[valid.length - 1];
  const jitter = (jSum / (valid.length - 1) / (pSum / valid.length)) * 100;

  // Shimmer (perturbación relativa media de amplitud)
  let sSum = 0;
  let aSum = 0;
  for (let i = 0; i < amps.length - 1; i++) {
    sSum += Math.abs(amps[i] - amps[i + 1]);
    aSum += amps[i];
  }
  aSum += amps[amps.length - 1] ?? 0;
  const shimmer = amps.length > 1 ? (sSum / (amps.length - 1) / (aSum / amps.length)) * 100 : 0;

  const hnr = hnrs && hnrs.length ? hnrs.reduce((a, b) => a + b, 0) / hnrs.length : 20;

  const quality: VoiceQuality = valid.length > 60 ? 'high' : valid.length > 25 ? 'med' : 'low';

  return {
    f0: round(avgF0, 1),
    jitter: round(jitter),
    shimmer: round(shimmer),
    hnr: round(hnr, 1),
    formants,
    quality,
  };
};

/* -------------------------------------------------------------------------- */
/*  Hook principal                                                             */
/* -------------------------------------------------------------------------- */

export function useVoiceAnalysis() {
  const [phase, setPhase] = useState<CapturePhase>('idle');
  const [progress, setProgress] = useState(0); // 0..1
  const [liveF0, setLiveF0] = useState<number | null>(null);
  const [level, setLevel] = useState(0); // 0..1 nivel en vivo
  const [takes, setTakes] = useState<VoiceTake[]>([]);
  const [selectedTakeId, setSelectedTakeId] = useState<number | null>(null);
  const [playingTakeId, setPlayingTakeId] = useState<number | null>(null);
  /** Toma a la que pertenece `result` (para invalidarlo si se borra). */
  const [analyzedTakeId, setAnalyzedTakeId] = useState<number | null>(null);
  const [result, setResult] = useState<AcousticResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [hasMic, setHasMic] = useState(() => !!micAdapter);

  // Refleja el (des)registro del adaptador aunque ocurra después del montaje.
  useEffect(() => {
    const listener = () => setHasMic(!!micAdapter);
    micListeners.add(listener);
    listener();
    return () => {
      micListeners.delete(listener);
    };
  }, []);

  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTs = useRef(0);
  const finishing = useRef(false);
  const nextTakeId = useRef(1);

  const teardown = useCallback(() => {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
  }, []);

  // Al desmontar: parar captura y reproducción nativas si quedaron abiertas.
  useEffect(
    () => () => {
      teardown();
      if (micAdapter) {
        if (finishing.current === false) {
          void Promise.resolve()
            .then(() => micAdapter?.stopRecording())
            .catch(() => {});
        }
        try {
          micAdapter.stopPlayback();
        } catch {
          /* noop */
        }
      }
    },
    [teardown],
  );

  const stopPlayback = useCallback(() => {
    try {
      micAdapter?.stopPlayback();
    } catch {
      /* noop */
    }
    setPlayingTakeId(null);
  }, []);

  /** Cierra la captura en curso y añade la toma a la lista. */
  const finish = useCallback(async () => {
    if (finishing.current) return;
    finishing.current = true;
    teardown();
    setProgress(0);
    try {
      if (!micAdapter) {
        setPhase('idle');
        return;
      }
      const pcm = await withTimeout(
        micAdapter.stopRecording(),
        STOP_TIMEOUT_MS,
        'El motor de audio no respondió al detener la grabación. Cierre y vuelva a abrir la pantalla.',
      );
      const durationSec = pcm.length / micAdapter.sampleRate;
      if (durationSec < MIN_TAKE_SEC) {
        setPhase('insufficient');
        return;
      }
      const take: VoiceTake = {
        id: nextTakeId.current++,
        pcm,
        durationSec: round(durationSec, 1),
        recordedAt: new Date(),
      };
      setTakes(prev => [...prev, take]);
      setSelectedTakeId(take.id);
      setPhase('idle');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Error al finalizar la grabación.');
      setPhase('error');
    } finally {
      finishing.current = false;
      setLiveF0(null);
      setLevel(0);
    }
  }, [teardown]);

  const startRecording = useCallback(async () => {
    if (!micAdapter) {
      setErrorMsg('El micrófono no está disponible en este dispositivo.');
      setPhase('error');
      return;
    }
    if (phase === 'recording' || finishing.current) return;

    stopPlayback();
    teardown();
    setProgress(0);
    setLiveF0(null);
    setLevel(0);
    setErrorMsg(null);

    try {
      await micAdapter.startRecording(frame => {
        if (frame.f0) setLiveF0(Math.round(frame.f0));
        setLevel(Math.min(1, frame.rms * 4));
      });
    } catch (e) {
      setErrorMsg(
        e instanceof Error && e.message
          ? e.message
          : 'No se pudo iniciar la grabación. Compruebe el permiso de micrófono.',
      );
      setPhase('error');
      return;
    }

    startTs.current = Date.now();
    setPhase('recording');
    timer.current = setInterval(() => {
      const p = Math.min(1, (Date.now() - startTs.current) / DURATION_MS);
      setProgress(p);
      if (p >= 1) finish();
    }, 100);
  }, [phase, teardown, finish, stopPlayback]);

  const stopRecording = useCallback(() => {
    if (phase === 'recording') finish();
  }, [phase, finish]);

  /** Analiza una toma de la lista (por defecto, la seleccionada). */
  const analyzeTake = useCallback(
    async (takeId?: number) => {
      const id = takeId ?? selectedTakeId;
      const take = takes.find(t => t.id === id);
      if (!micAdapter || !take || phase === 'recording' || phase === 'analyzing') return;

      stopPlayback();
      setSelectedTakeId(take.id);
      setResult(null);
      setAnalyzedTakeId(null);
      setErrorMsg(null);
      setPhase('analyzing');
      try {
        const r = await withTimeout(
          micAdapter.analyse(take.pcm),
          ANALYSE_TIMEOUT_MS,
          'El análisis tardó demasiado. Pruebe con otra toma.',
        );
        const params = computeParams(r);
        if (params) {
          setResult(params);
          setAnalyzedTakeId(take.id);
          setPhase('analyzed');
        } else {
          setPhase('insufficient');
        }
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : 'Error al analizar la grabación.');
        setPhase('error');
      }
    },
    [takes, selectedTakeId, phase, stopPlayback],
  );

  const selectTake = useCallback(
    (takeId: number) => {
      if (phase === 'analyzing') return;
      setSelectedTakeId(takeId);
    },
    [phase],
  );

  const playTake = useCallback(
    (takeId: number) => {
      const take = takes.find(t => t.id === takeId);
      if (!micAdapter || !take || phase === 'recording') return;
      if (playingTakeId === takeId) {
        stopPlayback();
        return;
      }
      stopPlayback();
      try {
        micAdapter.play(take.pcm, () => setPlayingTakeId(current => (current === takeId ? null : current)));
        setPlayingTakeId(takeId);
      } catch {
        setPlayingTakeId(null);
      }
    },
    [takes, phase, playingTakeId, stopPlayback],
  );

  const deleteTake = useCallback(
    (takeId: number) => {
      if (phase === 'analyzing') return;
      if (playingTakeId === takeId) stopPlayback();
      const remaining = takes.filter(t => t.id !== takeId);
      setTakes(remaining);
      if (selectedTakeId === takeId) {
        setSelectedTakeId(remaining.length ? remaining[remaining.length - 1].id : null);
      }
      if (analyzedTakeId === takeId) {
        setResult(null);
        setAnalyzedTakeId(null);
        setPhase('idle');
      }
    },
    [phase, playingTakeId, takes, selectedTakeId, analyzedTakeId, stopPlayback],
  );

  const reset = useCallback(() => {
    teardown();
    stopPlayback();
    setPhase('idle');
    setProgress(0);
    setLiveF0(null);
    setLevel(0);
    setTakes([]);
    setSelectedTakeId(null);
    setAnalyzedTakeId(null);
    setResult(null);
    setErrorMsg(null);
  }, [teardown, stopPlayback]);

  const source: VoiceSource = 'mic';

  return {
    phase,
    source,
    progress,
    liveF0,
    level,
    takes,
    selectedTakeId,
    playingTakeId,
    analyzedTakeId,
    result,
    errorMsg,
    isRecording: phase === 'recording',
    isAnalyzing: phase === 'analyzing',
    hasMic,
    startRecording,
    stopRecording,
    analyzeTake,
    selectTake,
    playTake,
    stopPlayback,
    deleteTake,
    reset,
  };
}
