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
  startRecording: (onLive?: (frame: VoiceLiveFrame) => void) => Promise<void>;
  stopRecording: () => Promise<VoiceMicResult>;
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

export type CapturePhase = 'idle' | 'recording' | 'analyzed' | 'insufficient' | 'error';

export interface AcousticResult {
  f0: number;
  jitter: number;
  shimmer: number;
  hnr: number;
  formants: VoiceFormants;
  quality: VoiceQuality;
}

const DURATION_MS = 5000;
/** Ventanas sonoras mínimas para un resultado clínicamente interpretable. */
const MIN_VOICED_FRAMES = 8;

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
  const voicedCount = useRef(0);

  const teardown = useCallback(() => {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
  }, []);

  // Al desmontar: parar la captura nativa si quedó abierta.
  useEffect(
    () => () => {
      teardown();
      if (micAdapter && finishing.current === false) {
        micAdapter.stopRecording().catch(() => {});
      }
    },
    [teardown],
  );

  const finish = useCallback(async () => {
    if (finishing.current) return;
    finishing.current = true;
    teardown();
    try {
      const r = micAdapter ? await micAdapter.stopRecording() : null;
      const params = r ? computeParams(r) : null;
      if (params) {
        setResult(params);
        setPhase('analyzed');
      } else {
        setResult(null);
        setPhase('insufficient');
      }
    } catch (e) {
      setResult(null);
      setErrorMsg(e instanceof Error ? e.message : 'Error al analizar la grabación.');
      setPhase('error');
    } finally {
      finishing.current = false;
    }
  }, [teardown]);

  const startRecording = useCallback(async () => {
    if (!micAdapter) {
      setErrorMsg('El micrófono no está disponible en este dispositivo.');
      setPhase('error');
      return;
    }
    if (phase === 'recording') return;

    teardown();
    setProgress(0);
    setLiveF0(null);
    setLevel(0);
    setResult(null);
    setErrorMsg(null);
    voicedCount.current = 0;

    try {
      await micAdapter.startRecording(frame => {
        if (frame.f0) {
          voicedCount.current += 1;
          setLiveF0(Math.round(frame.f0));
        }
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
  }, [phase, teardown, finish]);

  const stopRecording = useCallback(() => {
    if (phase === 'recording') finish();
  }, [phase, finish]);

  const reset = useCallback(() => {
    teardown();
    setPhase('idle');
    setProgress(0);
    setLiveF0(null);
    setLevel(0);
    setResult(null);
    setErrorMsg(null);
  }, [teardown]);

  const source: VoiceSource = 'mic';

  return {
    phase,
    source,
    progress,
    liveF0,
    level,
    result,
    errorMsg,
    isRecording: phase === 'recording',
    hasMic,
    startRecording,
    stopRecording,
    reset,
  };
}
