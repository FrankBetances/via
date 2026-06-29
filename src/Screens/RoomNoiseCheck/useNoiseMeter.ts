import { useCallback, useEffect, useRef, useState } from 'react';

/* -------------------------------------------------------------------------- */
/*  useNoiseMeter — medidor de ruido ambiente para React Native                */
/* -------------------------------------------------------------------------- */
/*  La app NO incluye (todavía) una librería de captura de micrófono. Este hook */
/*  abstrae la fuente de dB detrás de un "adaptador":                           */
/*                                                                              */
/*   • Si se ha registrado un adaptador nativo (setNoiseMicAdapter), el hook     */
/*     lo usa → source = 'mic' (lectura real del micrófono).                     */
/*   • Si no, cae a una señal SIMULADA determinista → source = 'demo'            */
/*     (misma forma de onda que el mockup, válida para demo/QA y para validar    */
/*     toda la lógica de veredicto y gating sin micrófono).                      */
/*                                                                              */
/*  Para activar el micrófono real, instala p. ej. `react-native-live-audio-     */
/*  stream`, calcula RMS → dBFS → dB aproximado y registra el adaptador. Ver el   */
/*  ejemplo en LEEME.md (§ "Micrófono real").                                     */
/* -------------------------------------------------------------------------- */

export type NoiseSource = 'idle' | 'mic' | 'demo';
export type NoiseZone = 'ok' | 'warn' | 'block';
export type NoiseVerdict = 'pending' | 'ok' | 'warn' | 'block';

export interface NoiseMicAdapter {
  /** Arranca la captura. Resuelve cuando el stream está listo. */
  start: () => Promise<void>;
  /** Detiene la captura y libera recursos. */
  stop: () => void;
  /** Último nivel medido en dB (escala A aproximada). null si aún no hay lectura. */
  read: () => number | null;
  /** (Opcional) niveles de banda 0..1 para el espectro; el hook sintetiza si falta. */
  spectrum?: () => number[];
}

let micAdapter: NoiseMicAdapter | null = null;

/** Registra un adaptador de micrófono real. Llámalo una vez al integrar la librería de audio. */
export const setNoiseMicAdapter = (adapter: NoiseMicAdapter | null) => {
  micAdapter = adapter;
};

export interface UseNoiseMeterOptions {
  /** Umbral de ruido apto en dB. */
  threshold: number;
  /** Duración de la medición en segundos. */
  testDurationSec: number;
  /** Nº de barras del espectro. */
  bars?: number;
  /** ms entre muestras de UI (no afecta al muestreo interno de la media). */
  intervalMs?: number;
}

export interface NoiseMeterApi {
  source: NoiseSource;
  running: boolean;
  db: number | null;
  zone: NoiseZone;
  levels: number[];
  avg: number | null;
  peak: number | null;
  verdict: NoiseVerdict;
  testing: boolean;
  testProgress: number;
  testRemaining: number;
  start: () => void;
  stop: () => void;
  runTest: () => void;
}

export const zoneOf = (db: number, threshold: number): NoiseZone =>
  db <= threshold ? 'ok' : db <= threshold + 10 ? 'warn' : 'block';

const clampDb = (n: number) => Math.max(28, Math.min(92, n));

export function useNoiseMeter({
  threshold,
  testDurationSec,
  bars = 24,
  intervalMs = 90,
}: UseNoiseMeterOptions): NoiseMeterApi {
  const [source, setSource] = useState<NoiseSource>('idle');
  const [db, setDb] = useState<number | null>(null);
  const [levels, setLevels] = useState<number[]>(() => new Array(bars).fill(0.04));
  const [avg, setAvg] = useState<number | null>(null);
  const [peak, setPeak] = useState<number | null>(null);
  const [verdict, setVerdict] = useState<NoiseVerdict>('pending');
  const [testing, setTesting] = useState(false);
  const [testRemaining, setTestRemaining] = useState(0);
  const [testProgress, setTestProgress] = useState(0);

  // refs (no provocan re-render)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const smooth = useRef<number | null>(null);
  const testActive = useRef(false);
  const testSamples = useRef<number[]>([]);
  const testPeak = useRef(0);
  const testStart = useRef(0);
  const srcRef = useRef<NoiseSource>('idle');

  const sampleDb = useCallback((): number => {
    if (srcRef.current === 'mic' && micAdapter) {
      const v = micAdapter.read();
      if (typeof v === 'number' && !isNaN(v)) return clampDb(v);
    }
    // señal simulada (idéntica al mockup)
    const t = Date.now() / 1000;
    const base = 36 + 3 * Math.sin(t * 0.6) + 2 * Math.sin(t * 1.7);
    const noise = Math.random() * 5;
    const spike = Math.random() < 0.012 ? 14 + Math.random() * 16 : 0;
    return clampDb(base + noise + spike);
  }, []);

  const sampleSpectrum = useCallback(
    (frac: number): number[] => {
      if (srcRef.current === 'mic' && micAdapter?.spectrum) {
        const s = micAdapter.spectrum();
        if (Array.isArray(s) && s.length) {
          return new Array(bars).fill(0).map((_, i) => {
            const v = s[Math.floor((i / bars) * s.length)] ?? 0;
            return Math.max(0.04, Math.min(1, v));
          });
        }
      }
      const now = Date.now() / 200;
      return new Array(bars).fill(0).map((_, i) => {
        const v = frac * (0.55 + 0.45 * Math.abs(Math.sin(i * 0.5 + now))) + Math.random() * 0.08;
        return Math.max(0.04, Math.min(1, v));
      });
    },
    [bars],
  );

  const tick = useCallback(() => {
    const raw = sampleDb();
    smooth.current = smooth.current == null ? raw : smooth.current * 0.78 + raw * 0.22;
    const sdb = smooth.current;
    const frac = Math.max(0, Math.min(1, (sdb - 28) / 64));

    setDb(sdb);
    setLevels(sampleSpectrum(frac));

    if (testActive.current) {
      testSamples.current.push(sdb);
      if (sdb > testPeak.current) testPeak.current = sdb;
      const elapsed = Date.now() - testStart.current;
      const durMs = testDurationSec * 1000;
      setTestProgress(Math.min(1, elapsed / durMs));
      const remain = Math.ceil((durMs - elapsed) / 1000);
      setTestRemaining(Math.max(0, remain));
      if (elapsed >= durMs) {
        testActive.current = false;
        const samples = testSamples.current;
        const a = samples.reduce((x, y) => x + y, 0) / (samples.length || 1);
        const p = testPeak.current;
        const v: NoiseVerdict = a <= threshold && p <= threshold + 12 ? 'ok' : a <= threshold + 8 ? 'warn' : 'block';
        setAvg(a);
        setPeak(p);
        setVerdict(v);
        setTesting(false);
        setTestProgress(1);
      }
    }
  }, [sampleDb, sampleSpectrum, testDurationSec, threshold]);

  const startLoop = useCallback(() => {
    if (timer.current) return;
    timer.current = setInterval(tick, intervalMs);
  }, [tick, intervalMs]);

  const teardown = useCallback(() => {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
    if (srcRef.current === 'mic' && micAdapter) {
      try {
        micAdapter.stop();
      } catch {}
    }
    smooth.current = null;
    testActive.current = false;
  }, []);

  const start = useCallback(() => {
    if (srcRef.current !== 'idle') return;
    if (micAdapter) {
      srcRef.current = 'mic';
      setSource('mic');
      micAdapter.start().catch(() => {
        // si el micrófono falla, caemos a demo
        srcRef.current = 'demo';
        setSource('demo');
      });
    } else {
      srcRef.current = 'demo';
      setSource('demo');
    }
    startLoop();
  }, [startLoop]);

  const stop = useCallback(() => {
    teardown();
    srcRef.current = 'idle';
    setSource('idle');
    setDb(null);
    setLevels(new Array(bars).fill(0.04));
    setAvg(null);
    setPeak(null);
    setVerdict('pending');
    setTesting(false);
    setTestProgress(0);
    setTestRemaining(0);
  }, [teardown, bars]);

  const beginTest = useCallback(() => {
    testSamples.current = [];
    testPeak.current = 0;
    testStart.current = Date.now();
    testActive.current = true;
    setTesting(true);
    setVerdict('pending');
    setTestRemaining(testDurationSec);
    setTestProgress(0);
  }, [testDurationSec]);

  const runTest = useCallback(() => {
    if (testActive.current) return;
    if (srcRef.current === 'idle') {
      start();
      setTimeout(beginTest, 350);
    } else {
      beginTest();
    }
  }, [start, beginTest]);

  useEffect(() => () => teardown(), [teardown]);

  const currentZone: NoiseZone = db == null ? 'ok' : zoneOf(db, threshold);

  return {
    source,
    running: source !== 'idle',
    db,
    zone: currentZone,
    levels,
    avg,
    peak,
    verdict,
    testing,
    testProgress,
    testRemaining,
    start,
    stop,
    runTest,
  };
}
