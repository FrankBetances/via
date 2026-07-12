import {
  meanSquare,
  meanSquareToSpl,
  NOISE_BANDS,
  NOISE_DB_MAX,
  NOISE_DB_MIN,
  smoothBands,
  spectrumBands,
  splFraction,
  updateLeqMeanSquare,
} from '../noiseDsp';

/* -------------------------------------------------------------------------- */
/*  Pruebas del DSP del sonómetro. Regresión del bug «mediciones al azar»:      */
/*   (1) el nivel se promedia en energía (Leq) → estable entre bloques;         */
/*   (2) el espectro es una FFT real → un tono cae en SU banda, no al azar.     */
/* -------------------------------------------------------------------------- */

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

  it('más amplitud → más dB (monótono) y acotado a [28, 92]', () => {
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
