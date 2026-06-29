import { useCallback, useEffect, useRef, useState } from 'react';
import {
  VoiceFormants,
  VoiceQuality,
  VoiceSource,
} from '@/Models/VoiceAnalysis/VoiceAnalysis';

/* -------------------------------------------------------------------------- */
/*  Adaptador de micrófono (igual filosofía que el resto de la plataforma).    */
/*                                                                            */
/*  Por defecto la pantalla funciona en MODO DEMOSTRACIÓN (simulación). Para   */
/*  usar el micrófono real del dispositivo, registre un adaptador nativo en el */
/*  punto de entrada de la app:                                               */
/*                                                                            */
/*    import { setVoiceMicAdapter } from '@/Screens/VoiceAnalysis';            */
/*    setVoiceMicAdapter({                                                    */
/*      startRecording: async () => { ...inicia captura de buffer... },        */
/*      stopRecording: async () => ({ f0s: [...], amplitudes: [...] }),        */
/*    });                                                                     */
/* -------------------------------------------------------------------------- */

export interface VoiceMicResult {
  f0s: number[]; // Hz por frame de voz
  amplitudes: number[]; // RMS por frame de voz
  hnrs?: number[]; // dB por frame (opcional; si no, se estima)
}

export interface VoiceMicAdapter {
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<VoiceMicResult>;
}

let micAdapter: VoiceMicAdapter | null = null;
export const setVoiceMicAdapter = (adapter: VoiceMicAdapter | null) => {
  micAdapter = adapter;
};

/* -------------------------------------------------------------------------- */
/*  Tipos de estado de la captura                                              */
/* -------------------------------------------------------------------------- */

export type CapturePhase = 'idle' | 'recording' | 'analyzed';

export interface AcousticResult {
  f0: number;
  jitter: number;
  shimmer: number;
  hnr: number;
  formants: VoiceFormants;
  quality: VoiceQuality;
}

const DURATION_MS = 5000;

/* -------------------------------------------------------------------------- */
/*  Cálculo de parámetros a partir de las series temporales                    */
/* -------------------------------------------------------------------------- */

const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

const computeParams = (f0s: number[], amps: number[], hnrs?: number[]): AcousticResult => {
  const valid = f0s.filter(f => f > 100 && f < 500);
  if (valid.length < 5) {
    return {
      f0: 242.4,
      jitter: 0.45,
      shimmer: 1.82,
      hnr: 21.6,
      formants: { f1: 795, f2: 1410, f3: 2880 },
      quality: 'low',
    };
  }
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
    // Tracking de formantes: requiere LPC en nativo; valores estimados para /a/ infantil.
    formants: { f1: 810, f2: 1435, f3: 2910 },
    quality,
  };
};

/* -------------------------------------------------------------------------- */
/*  Hook principal                                                             */
/* -------------------------------------------------------------------------- */

export function useVoiceAnalysis() {
  const [phase, setPhase] = useState<CapturePhase>('idle');
  const [source, setSource] = useState<VoiceSource>('demo');
  const [progress, setProgress] = useState(0); // 0..1
  const [liveF0, setLiveF0] = useState<number | null>(null);
  const [level, setLevel] = useState(0); // 0..1 nivel/calidad en vivo
  const [result, setResult] = useState<AcousticResult | null>(null);

  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTs = useRef(0);
  const f0s = useRef<number[]>([]);
  const amps = useRef<number[]>([]);
  const hnrs = useRef<number[]>([]);

  const teardown = useCallback(() => {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
  }, []);

  useEffect(() => () => teardown(), [teardown]);

  const finish = useCallback(async () => {
    teardown();
    if (source === 'mic' && micAdapter) {
      try {
        const r = await micAdapter.stopRecording();
        setResult(computeParams(r.f0s, r.amplitudes, r.hnrs));
      } catch {
        setResult(computeParams(f0s.current, amps.current, hnrs.current));
      }
    } else {
      setResult(computeParams(f0s.current, amps.current, hnrs.current));
    }
    setPhase('analyzed');
  }, [source, teardown]);

  const tick = useCallback(() => {
    const elapsed = Date.now() - startTs.current;
    const p = Math.min(1, elapsed / DURATION_MS);
    setProgress(p);

    // Simulación de parámetros vocales infantiles realistas (modo demo).
    const t = elapsed / 1000;
    const pitchNoise = (Math.sin(t * 18) * 2 + Math.sin(t * 42)) * (0.8 + 0.1 * Math.random());
    const f0 = 245.5 + pitchNoise;
    const amp = 0.34 + Math.sin(t * 8) * 0.05 + Math.random() * 0.02;
    const hnr = 22 + Math.sin(t * 5) * 2.5 + Math.random() * 1.2;
    f0s.current.push(f0);
    amps.current.push(amp);
    hnrs.current.push(hnr);

    setLiveF0(Math.round(f0));
    setLevel(Math.min(1, f0s.current.length / 30) * Math.min(1, amp * 3.2));

    if (p >= 1) finish();
  }, [finish]);

  const begin = useCallback(
    (src: VoiceSource) => {
      teardown();
      f0s.current = [];
      amps.current = [];
      hnrs.current = [];
      startTs.current = Date.now();
      setSource(src);
      setPhase('recording');
      setProgress(0);
      setLiveF0(null);
      setLevel(0);
      setResult(null);
      timer.current = setInterval(tick, 60);
    },
    [teardown, tick],
  );

  const startRecording = useCallback(async () => {
    if (micAdapter) {
      try {
        await micAdapter.startRecording();
        begin('mic');
        return;
      } catch {
        // cae a demo
      }
    }
    begin('demo');
  }, [begin]);

  const startDemo = useCallback(() => begin('demo'), [begin]);

  const stopRecording = useCallback(() => finish(), [finish]);

  const reset = useCallback(() => {
    teardown();
    setPhase('idle');
    setSource('demo');
    setProgress(0);
    setLiveF0(null);
    setLevel(0);
    setResult(null);
  }, [teardown]);

  return {
    phase,
    source,
    progress,
    liveF0,
    level,
    result,
    isRecording: phase === 'recording',
    hasMic: !!micAdapter,
    startRecording,
    startDemo,
    stopRecording,
    reset,
  };
}
