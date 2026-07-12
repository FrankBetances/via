import { useCallback, useEffect, useRef, useState } from 'react';
import { clamp } from '@/Helpers/numeric';

/* -------------------------------------------------------------------------- */
/*  useNoiseMeter — medidor de ruido ambiente para React Native                */
/* -------------------------------------------------------------------------- */
/*  El hook abstrae la fuente de dB detrás de un "adaptador" registrado con    */
/*  `setNoiseMicAdapter` (la pantalla lo hace con `registerNoiseMicAdapter`,   */
/*  basado en react-native-audio-api).                                         */
/*                                                                             */
/*  El modo demostración (señal simulada) se eliminó: sin micrófono el hook    */
/*  pasa a source = 'error' y NO produce lecturas ni veredicto — una app       */
/*  clínica no debe simular la verificación de la sala. Una medición sin       */
/*  muestras reales tampoco emite veredicto.                                   */
/* -------------------------------------------------------------------------- */

export type NoiseSource = 'idle' | 'mic' | 'error';
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
  /** Motivo del fallo cuando source === 'error' (o medición sin señal). */
  error: string | null;
  db: number | null;
  zone: NoiseZone;
  levels: number[];
  avg: number | null;
  peak: number | null;
  verdict: NoiseVerdict;
  testing: boolean;
  testProgress: number;
  testRemaining: number;
  /** Arranca la captura; resuelve `true` si el micrófono quedó operativo. */
  start: () => Promise<boolean>;
  stop: () => void;
  runTest: () => void;
}

export const zoneOf = (db: number, threshold: number): NoiseZone =>
  db <= threshold ? 'ok' : db <= threshold + 10 ? 'warn' : 'block';

const clampDb = (n: number) => clamp(n, 28, 92);

export function useNoiseMeter({
  threshold,
  testDurationSec,
  bars = 24,
  intervalMs = 90,
}: UseNoiseMeterOptions): NoiseMeterApi {
  const [source, setSource] = useState<NoiseSource>('idle');
  const [error, setError] = useState<string | null>(null);
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

  /** Lectura real del micrófono; `null` mientras no haya señal (calentamiento,
   *  permiso pendiente o fallo del stream). Nunca se simulan valores. */
  const sampleDb = useCallback((): number | null => {
    if (srcRef.current !== 'mic' || !micAdapter) return null;
    const v = micAdapter.read();
    return typeof v === 'number' && !isNaN(v) ? clampDb(v) : null;
  }, []);

  const sampleSpectrum = useCallback(
    (): number[] => {
      // Espectro REAL del adaptador (FFT por bandas). Sin señal, barras planas
      // al suelo: NUNCA se sintetizan valores aleatorios (antes `Math.random()`
      // hacía bailar las barras «al azar» y se percibía como medición falsa).
      if (srcRef.current === 'mic' && micAdapter?.spectrum) {
        const s = micAdapter.spectrum();
        if (Array.isArray(s) && s.length) {
          return new Array(bars).fill(0).map((_, i) => {
            const v = s[Math.floor((i / bars) * s.length)] ?? 0;
            return Math.max(0.04, Math.min(1, v));
          });
        }
      }
      return new Array(bars).fill(0.04);
    },
    [bars],
  );

  const tick = useCallback(() => {
    const raw = sampleDb();
    if (raw != null) {
      // El adaptador ya entrega un nivel promediado energéticamente (Leq); esta
      // EMA ligera solo suaviza el refresco de la UI.
      smooth.current = smooth.current == null ? raw : smooth.current * 0.78 + raw * 0.22;
      const sdb = smooth.current;

      setDb(sdb);
      setLevels(sampleSpectrum());

      if (testActive.current) {
        testSamples.current.push(sdb);
        if (sdb > testPeak.current) testPeak.current = sdb;
      }
    }

    if (testActive.current) {
      const elapsed = Date.now() - testStart.current;
      const durMs = testDurationSec * 1000;
      setTestProgress(Math.min(1, elapsed / durMs));
      const remain = Math.ceil((durMs - elapsed) / 1000);
      setTestRemaining(Math.max(0, remain));
      if (elapsed >= durMs) {
        testActive.current = false;
        const samples = testSamples.current;
        // Sin ~1 s de señal real no hay veredicto: promediar 0 muestras daría
        // 0 dB y un falso "SALA APTA".
        const minSamples = Math.max(5, Math.ceil(1000 / intervalMs));
        if (samples.length < minSamples) {
          setAvg(null);
          setPeak(null);
          setVerdict('pending');
          setError('El micrófono no entregó señal durante la medición. Compruebe el permiso de micrófono y repita.');
        } else {
          const a = samples.reduce((x, y) => x + y, 0) / samples.length;
          const p = testPeak.current;
          const v: NoiseVerdict = a <= threshold && p <= threshold + 12 ? 'ok' : a <= threshold + 8 ? 'warn' : 'block';
          setAvg(a);
          setPeak(p);
          setVerdict(v);
        }
        setTesting(false);
        setTestProgress(1);
      }
    }
  }, [sampleDb, sampleSpectrum, testDurationSec, threshold, intervalMs]);

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

  const start = useCallback((): Promise<boolean> => {
    if (srcRef.current === 'mic') return Promise.resolve(true); // ya activo; permite reintentar desde 'error'
    setError(null);
    if (!micAdapter) {
      srcRef.current = 'error';
      setSource('error');
      setError('El micrófono no está disponible en este dispositivo.');
      return Promise.resolve(false);
    }
    srcRef.current = 'mic';
    setSource('mic');
    startLoop();
    return micAdapter
      .start()
      .then(() => true)
      .catch((e: unknown) => {
        // sin micrófono no hay medición: estado de error explícito (nunca datos simulados)
        teardown();
        srcRef.current = 'error';
        setSource('error');
        setDb(null);
        setTesting(false);
        setTestProgress(0);
        setTestRemaining(0);
        setError(
          e instanceof Error && e.message ? e.message : 'No se pudo iniciar el micrófono. Compruebe el permiso.',
        );
        return false;
      });
  }, [startLoop, teardown]);

  const stop = useCallback(() => {
    teardown();
    srcRef.current = 'idle';
    setSource('idle');
    setError(null);
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
    setError(null);
    setVerdict('pending');
    setTestRemaining(testDurationSec);
    setTestProgress(0);
  }, [testDurationSec]);

  const runTest = useCallback(() => {
    if (testActive.current) return;
    if (srcRef.current !== 'mic') {
      // espera a que el micrófono arranque de verdad (permiso incluido) y deja
      // ~350 ms de calentamiento; si falló, queda el estado de error visible.
      void start().then(ok => {
        if (ok && srcRef.current === 'mic') {
          setTimeout(() => {
            if (srcRef.current === 'mic') beginTest();
          }, 350);
        }
      });
    } else {
      beginTest();
    }
  }, [start, beginTest]);

  useEffect(() => () => teardown(), [teardown]);

  const currentZone: NoiseZone = db == null ? 'ok' : zoneOf(db, threshold);

  return {
    source,
    running: source === 'mic',
    error,
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
