import { useCallback, useEffect, useRef, useState } from 'react';
import { clamp } from '@/Helpers/numeric';
import { energyAverageDb, NOISE_DB_MAX, NOISE_DB_MIN, percentileDb } from './noiseDsp';

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
  /** Último nivel medido en dB(A). null si aún no hay lectura. */
  read: () => number | null;
  /** (Opcional) niveles de banda 0..1 para el espectro; el hook sintetiza si falta. */
  spectrum?: () => number[];
  /**
   * (Opcional) ¿ha entregado el motor nativo ALGÚN bloque desde el arranque?
   * Permite distinguir «el micrófono no emite nada» (stream abierto pero mudo:
   * ocupado por otra app, ruta de audio sin entrada…) de «la sala está en
   * silencio», sin esperar a que termine la medición completa.
   */
  hasSignal?: () => boolean;
  /**
   * (Opcional) niveles dB(A) por BLOQUE de captura (~100 ms) acumulados desde
   * la última llamada, que se vacían al leerlos. Son la materia prima de la
   * estadística de la medición: LAeq y percentiles se calculan sobre el nivel
   * real de cada bloque, no sobre la lectura ya suavizada del gauge (que
   * comprime los picos y desdibuja el ruido de fondo).
   */
  takeBlockLevels?: () => number[];
  /** (Opcional) bloques descartados por saturación desde el arranque. */
  clippedBlocks?: () => number;
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
  /** LAeq de la medición (media ENERGÉTICA, no aritmética, de los dB). */
  avg: number | null;
  /** L10: nivel superado el 10 % del tiempo. Representa los picos SOSTENIDOS,
   *  no el golpe aislado que antes se colaba como «pico máximo». */
  peak: number | null;
  /** L90: nivel superado el 90 % del tiempo = ruido de FONDO de la sala. */
  background: number | null;
  /** Bloques descartados por saturación durante la medición (manejo del equipo). */
  clipped: number;
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

const clampDb = (n: number) => clamp(n, NOISE_DB_MIN, NOISE_DB_MAX);

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
  const [background, setBackground] = useState<number | null>(null);
  const [clipped, setClipped] = useState(0);
  const [verdict, setVerdict] = useState<NoiseVerdict>('pending');
  const [testing, setTesting] = useState(false);
  const [testRemaining, setTestRemaining] = useState(0);
  const [testProgress, setTestProgress] = useState(0);

  // refs (no provocan re-render)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const smooth = useRef<number | null>(null);
  const testActive = useRef(false);
  const testSamples = useRef<number[]>([]);
  const testStart = useRef(0);
  const clippedAtStart = useRef(0);
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

  /** Niveles por bloque (~100 ms) desde la última llamada. Si el adaptador no
   *  los expone (adaptadores de prueba antiguos), degrada a la lectura
   *  suavizada actual, que es lo que se hacía históricamente. */
  const drainBlockLevels = useCallback((fallback: number | null): number[] => {
    if (micAdapter?.takeBlockLevels) {
      return micAdapter.takeBlockLevels().map(clampDb);
    }
    return fallback == null ? [] : [fallback];
  }, []);

  const tick = useCallback(() => {
    const raw = sampleDb();
    if (raw != null) {
      // El adaptador ya entrega un nivel promediado energéticamente (Leq); esta
      // EMA ligera solo suaviza el refresco de la UI.
      smooth.current = smooth.current == null ? raw : smooth.current * 0.78 + raw * 0.22;
      setDb(smooth.current);
      setLevels(sampleSpectrum());
    }

    if (testActive.current) {
      // La estadística se hace sobre el nivel de CADA bloque de captura, no
      // sobre la muestra suavizada del gauge: así el LAeq es el de verdad y
      // los percentiles separan el fondo de sala de los picos.
      for (const db of drainBlockLevels(smooth.current)) testSamples.current.push(db);

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
          setBackground(null);
          setVerdict('pending');
          // Se distingue el stream abierto pero MUDO (otra app tiene el
          // micrófono, la ruta de audio no tiene entrada) del permiso ausente:
          // el mensaje genérico anterior mandaba a revisar un permiso que ya
          // estaba concedido.
          const gotBlocks = micAdapter?.hasSignal?.() ?? null;
          setError(
            gotBlocks === false
              ? 'El micrófono no entregó ninguna muestra: puede estar en uso por otra aplicación o silenciado por el sistema. Ciérrelas y repita la medición.'
              : 'El micrófono no entregó señal suficiente durante la medición. Compruebe el permiso de micrófono y repita.',
          );
        } else {
          // LAeq (media energética) + percentiles, como un sonómetro:
          //  · L90 = ruido de FONDO real de la sala, que es lo que invalida una
          //    audiometría (ISO 8253-1 habla del ruido de fondo, no de un
          //    portazo puntual);
          //  · L10 = picos SOSTENIDOS. El máximo absoluto que se usaba antes
          //    convertía cualquier roce del dispositivo en un veredicto de
          //    «demasiado ruido», y era otra vía por la que el resultado
          //    parecía aleatorio.
          const a = energyAverageDb(samples) as number;
          const l10 = percentileDb(samples, 90) as number;
          const l90 = percentileDb(samples, 10) as number;
          const v: NoiseVerdict =
            a <= threshold && l10 <= threshold + 12 ? 'ok' : a <= threshold + 8 ? 'warn' : 'block';
          setAvg(a);
          setPeak(l10);
          setBackground(l90);
          setVerdict(v);
        }
        setClipped(Math.max(0, (micAdapter?.clippedBlocks?.() ?? 0) - clippedAtStart.current));
        setTesting(false);
        setTestProgress(1);
      }
    }
  }, [sampleDb, sampleSpectrum, drainBlockLevels, testDurationSec, threshold, intervalMs]);

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
    setBackground(null);
    setClipped(0);
    setVerdict('pending');
    setTesting(false);
    setTestProgress(0);
    setTestRemaining(0);
  }, [teardown, bars]);

  const beginTest = useCallback(() => {
    testSamples.current = [];
    // Descarta los bloques acumulados antes de arrancar la medición: son del
    // periodo de ajuste previo, no de la ventana que se está midiendo.
    micAdapter?.takeBlockLevels?.();
    clippedAtStart.current = micAdapter?.clippedBlocks?.() ?? 0;
    setClipped(0);
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
    background,
    clipped,
    verdict,
    testing,
    testProgress,
    testRemaining,
    start,
    stop,
    runTest,
  };
}
