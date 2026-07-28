import {
  aWeight,
  aWeightMeanSquare,
  aWeightingDb,
  getNoiseCalibrationOffset,
  meanSquare,
  meanSquareToSpl,
  NOISE_BANDS,
  NOISE_DB_MAX,
  NOISE_DB_MIN,
  NOISE_OFFSET_LIMIT_DB,
  NOISE_SPL_AT_FULL_SCALE,
  setNoiseCalibrationOffset,
  smoothBands,
  spectrumBands,
  splFraction,
  updateLeqMeanSquare,
} from '../noiseDsp';

/* -------------------------------------------------------------------------- */
/*  Pruebas del DSP del sonómetro. Regresión del bug «mediciones al azar»:      */
/*   (1) el nivel se promedia en energía (Leq) → estable entre bloques;         */
/*   (2) el espectro es una FFT real → un tono cae en SU banda, no al azar.     */
/*  Y del bug de CALIBRACIÓN («cuando funciona parece que no está bien          */
/*  calibrado»):                                                                */
/*   (3) la lectura lleva ponderación A (IEC 61672) → el retumbe grave deja de  */
/*       inflar el nivel;                                                       */
/*   (4) la referencia dBFS→SPL es la de un micrófono real y hay offset de      */
/*       campo para anclar la lectura a un sonómetro patrón.                    */
/* -------------------------------------------------------------------------- */

afterEach(() => setNoiseCalibrationOffset(0));

const SR = 48000;
const N = 4096;

/** Bloque PCM de un tono puro a `freq` Hz con amplitud `amp`. */
const sine = (freq: number, amp = 0.3, n = N): Float32Array => {
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = amp * Math.sin((2 * Math.PI * freq * i) / SR);
  return x;
};

describe('nivel: energía → dB SPL orientativo', () => {
  it('meanSquare de un seno = amp²/2', () => {
    expect(meanSquare(sine(1000, 0.5))).toBeCloseTo(0.125, 3);
  });

  it('la escala se ancla en la referencia del micrófono (RMS 1.0 = fondo de escala)', () => {
    // Un seno de amplitud A tiene RMS A/√2 → el nivel es REF + 20·log10(rms).
    const amp = 0.1;
    const rms = amp / Math.SQRT2;
    expect(meanSquareToSpl(meanSquare(sine(1000, amp)))).toBeCloseTo(
      NOISE_SPL_AT_FULL_SCALE + 20 * Math.log10(rms),
      2,
    );
  });

  it('más amplitud → más dB (monótono) y acotado a la escala', () => {
    const quiet = meanSquareToSpl(meanSquare(sine(1000, 0.001)));
    const mid = meanSquareToSpl(meanSquare(sine(1000, 0.03)));
    const loud = meanSquareToSpl(meanSquare(sine(1000, 0.5)));
    expect(quiet).toBeLessThan(mid);
    expect(mid).toBeLessThan(loud);
    for (const v of [quiet, mid, loud]) {
      expect(v).toBeGreaterThanOrEqual(NOISE_DB_MIN);
      expect(v).toBeLessThanOrEqual(NOISE_DB_MAX);
    }
  });

  it('silencio digital cae al suelo de la escala', () => {
    expect(meanSquareToSpl(meanSquare(new Float32Array(N)))).toBe(NOISE_DB_MIN);
  });

  it('splFraction está en [0, 1]', () => {
    expect(splFraction(10)).toBe(0);
    expect(splFraction(200)).toBe(1);
    expect(splFraction((NOISE_DB_MIN + NOISE_DB_MAX) / 2)).toBeCloseTo(0.5, 5);
  });

  it('una sala normal (≈45 dB(A)) cae DENTRO de la escala, no clavada en el suelo', () => {
    // Regresión de la calibración: con la referencia anterior (0 dBFS ↔ 92 dB)
    // un nivel de sala realista quedaba por debajo del mínimo y el sonómetro
    // marcaba siempre el suelo de la escala.
    const rmsDeSala = Math.pow(10, (45 - NOISE_SPL_AT_FULL_SCALE) / 20);
    const db = meanSquareToSpl(rmsDeSala * rmsDeSala); // ms = rms²
    expect(db).toBeGreaterThan(NOISE_DB_MIN);
    expect(db).toBeLessThan(NOISE_DB_MAX);
    expect(db).toBeCloseTo(45, 1);
  });
});

describe('calibración de campo (offset ajustable)', () => {
  it('el offset desplaza la lectura dB a dB', () => {
    const ms = meanSquare(sine(1000, 0.02));
    const base = meanSquareToSpl(ms);
    setNoiseCalibrationOffset(6);
    expect(meanSquareToSpl(ms)).toBeCloseTo(base + 6, 5);
    setNoiseCalibrationOffset(-6);
    expect(meanSquareToSpl(ms)).toBeCloseTo(base - 6, 5);
  });

  it('se acota al límite y se ignora un valor no finito', () => {
    expect(setNoiseCalibrationOffset(999)).toBe(NOISE_OFFSET_LIMIT_DB);
    expect(setNoiseCalibrationOffset(-999)).toBe(-NOISE_OFFSET_LIMIT_DB);
    expect(setNoiseCalibrationOffset(Number.NaN)).toBe(0);
    expect(getNoiseCalibrationOffset()).toBe(0);
  });
});

describe('ponderación A (IEC 61672)', () => {
  // Tabla de referencia de la norma (clase 1/2). La tolerancia se relaja en
  // los extremos por la distorsión de frecuencia de la bilineal, que no afecta
  // a la banda de interés del ruido de sala (125 Hz – 8 kHz).
  it.each([
    [31.5, -39.4, 1.5],
    [63, -26.2, 1.0],
    [125, -16.1, 0.5],
    [250, -8.6, 0.5],
    [500, -3.2, 0.5],
    [1000, 0, 0.01],
    [2000, 1.2, 0.5],
    [4000, 1.0, 0.5],
    [8000, -1.1, 1.5],
  ])('a %i Hz atenúa ≈ %s dB', (freq, expected, tol) => {
    expect(Math.abs(aWeightingDb(freq as number, SR) - (expected as number))).toBeLessThanOrEqual(tol as number);
  });

  it('el retumbe grave deja de inflar la lectura (motivo del bug de calibración)', () => {
    // Mismo nivel físico a 50 Hz y a 1 kHz: sin ponderar leen igual; con
    // ponderación A el grave queda >25 dB por debajo, como en un sonómetro.
    const grave = sine(50, 0.1);
    const habla = sine(1000, 0.1);
    expect(meanSquareToSpl(meanSquare(grave))).toBeCloseTo(meanSquareToSpl(meanSquare(habla)), 1);
    const dbGrave = meanSquareToSpl(aWeightMeanSquare(grave, SR));
    const dbHabla = meanSquareToSpl(aWeightMeanSquare(habla, SR));
    expect(dbHabla - dbGrave).toBeGreaterThan(25);
  });

  it('no altera el nivel en 1 kHz (normalización de la curva)', () => {
    const x = sine(1000, 0.2);
    expect(meanSquareToSpl(aWeightMeanSquare(x, SR))).toBeCloseTo(meanSquareToSpl(meanSquare(x)), 0);
  });

  it('es estable: no introduce NaN ni diverge con silencio o con señal fuerte', () => {
    for (const x of [new Float32Array(N), sine(1000, 1), sine(80, 0.9)]) {
      const y = aWeight(x, SR);
      expect(y.length).toBe(x.length);
      expect(y.every(v => Number.isFinite(v))).toBe(true);
    }
  });
});

describe('Leq: el promedio energético estabiliza la lectura', () => {
  it('bloque constante → el Leq converge a ese nivel', () => {
    const ms = meanSquare(sine(1000, 0.1));
    let leq: number | null = null;
    for (let i = 0; i < 50; i++) leq = updateLeqMeanSquare(leq, ms, 0.12);
    expect(meanSquareToSpl(leq as number)).toBeCloseTo(meanSquareToSpl(ms), 5);
  });

  it('con energía fluctuante, el dB del Leq varía MUCHO menos que el dB por bloque', () => {
    // Ruido cuya energía oscila ±. El nivel real medio es estable; el RMS por
    // bloque salta, el Leq no.
    let seed = 12345;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    const perBlockDb: number[] = [];
    const leqDb: number[] = [];
    let leq: number | null = null;
    for (let b = 0; b < 60; b++) {
      // energía media 0.01 con oscilación fuerte (×0.2..×1.8)
      const amp = Math.sqrt(0.01 * (0.2 + 1.6 * rand()));
      const ms = meanSquare(sine(1000, amp));
      perBlockDb.push(meanSquareToSpl(ms));
      leq = updateLeqMeanSquare(leq, ms, 0.12);
      leqDb.push(meanSquareToSpl(leq));
    }
    const std = (a: number[]) => {
      const m = a.reduce((x, y) => x + y, 0) / a.length;
      return Math.sqrt(a.reduce((s, y) => s + (y - m) ** 2, 0) / a.length);
    };
    // descarta el calentamiento inicial del Leq
    expect(std(leqDb.slice(15))).toBeLessThan(std(perBlockDb.slice(15)) * 0.5);
  });
});

describe('espectro: FFT real por bandas de frecuencia', () => {
  const bandArgmax = (bands: number[]) => bands.indexOf(Math.max(...bands));
  // Banda log que contiene una frecuencia (mismo esquema que spectrumBands).
  const bandOf = (freq: number) => {
    const fLow = 80;
    const fHigh = Math.min(SR * 0.45, 16000);
    const frac = (Math.log(freq) - Math.log(fLow)) / (Math.log(fHigh) - Math.log(fLow));
    return Math.min(NOISE_BANDS - 1, Math.max(0, Math.floor(frac * NOISE_BANDS)));
  };

  it.each([300, 1000, 4000, 8000])('un tono a %i Hz produce el pico en SU banda (±1)', freq => {
    const bands = spectrumBands(sine(freq, 0.4), SR);
    expect(bands.length).toBe(NOISE_BANDS);
    // El pico se localiza en la banda de la frecuencia (±1 por fuga espectral
    // en los bordes de banda). Lo esencial: NO cae al azar en otra región.
    expect(Math.abs(bandArgmax(bands) - bandOf(freq))).toBeLessThanOrEqual(1);
  });

  it('el silencio deja todas las barras en el suelo (0.04)', () => {
    const bands = spectrumBands(new Float32Array(N), SR);
    expect(Math.max(...bands)).toBeCloseTo(0.04, 5);
  });

  it('es determinista: misma entrada → mismo espectro (no aleatorio)', () => {
    const x = sine(2000, 0.3);
    expect(spectrumBands(x, SR)).toEqual(spectrumBands(x, SR));
  });

  it('un tono más fuerte eleva su banda', () => {
    const soft = spectrumBands(sine(1000, 0.05), SR);
    const loud = spectrumBands(sine(1000, 0.5), SR);
    const b = bandOf(1000);
    expect(loud[b]).toBeGreaterThan(soft[b]);
  });
});

describe('smoothBands', () => {
  it('mezcla con el frame previo; sin previo devuelve el actual', () => {
    expect(smoothBands(null, [0.5, 0.5])).toEqual([0.5, 0.5]);
    expect(smoothBands([0, 0], [1, 1], 0.5)).toEqual([0.5, 0.5]);
  });
});
